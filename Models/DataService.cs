using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Odbc;
using System.Linq;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using Hangfire;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System.Threading.Tasks;
using System.Net.Http;
using System.Collections.Specialized;
using System.Web;
using System.Text;
using System.Net;
using System.Net.Http.Headers;
using System.IO;
using System.Xml.Linq;
using CampusLogicEvents.Implementation.Extensions;
using CampusLogicEvents.Web.Filters;
using Newtonsoft.Json.Serialization;
using Microsoft.Ajax.Utilities;

namespace CampusLogicEvents.Web.Models
{
    public static class DataService
    {
        private static readonly CampusLogicSection campusLogicConfigSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);

        /// <summary>
        /// Process the Notification Events by storing each event received and then queue them each for processing
        /// </summary>
        /// <param name="eventData"></param>
        public static void ReceivePostedEvents(IEnumerable<JObject> eventData)
        {
            if (campusLogicConfigSection.EventNotifications.EventNotificationsEnabled ?? false)
            {
                using (var dbContext = new CampusLogicContext())
                {
                    foreach (JObject notificationEvent in eventData)
                    {
                        //SV-1698 Allowing requeue of events already processed
                        //First verify we didn't already get and process this event using the unique identifier within the configured purge day window before we clear old events
                        var id = notificationEvent["Id"].ToString();
                        var existingEvent = dbContext.ReceivedEvents.FirstOrDefault(x => x.Id == id);

                        if (existingEvent == null)
                        {
                            dbContext.ReceivedEvents.Add(new ReceivedEvent()
                            {
                                Id = notificationEvent["Id"].ToString(),
                                EventData = notificationEvent.ToString(),
                                ReceivedDateTime = DateTime.UtcNow
                            });
                        }
                        else
                        {
                            existingEvent.EventData = notificationEvent.ToString();
                            existingEvent.ReceivedDateTime = DateTime.UtcNow;
                        }

                        dbContext.SaveChanges();

                        BackgroundJob.Enqueue(() => ProcessPostedEvent(notificationEvent));
                    }
                }
            }
        }

        public static void GetDefaultDatabaseProcedure(EventNotificationData eventData, string storedProcedureName)
        {
            var parameters = new List<OdbcParameter>();

            //Define parameters
            parameters.Add(new OdbcParameter
            {
                ParameterName = "StudentId",
                OdbcType = OdbcType.VarChar,
                Size = 9,
                Value = eventData.PropertyValues[EventPropertyConstants.StudentId].Value<string>()
            });

            parameters.Add(new OdbcParameter
            {
                ParameterName = "AwardYear",
                OdbcType = OdbcType.VarChar,
                Size = 4,
                Value = eventData.PropertyValues[EventPropertyConstants.AwardYear].IsNullOrEmpty() ? string.Empty : (eventData.PropertyValues[EventPropertyConstants.AwardYear].Value<string>().Substring(2, 2) + eventData.PropertyValues[EventPropertyConstants.AwardYear].Value<string>().Substring(7, 2))
            });

            parameters.Add(new OdbcParameter
            {
                ParameterName = "TransactionCategoryId",
                OdbcType = OdbcType.Int,
                Value = eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId].IsNullOrEmpty() ? 0 : eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId].Value<int>()
            });

            parameters.Add(new OdbcParameter
            {
                ParameterName = "EventNotificationId",
                OdbcType = OdbcType.Int,
                Value = eventData.PropertyValues[EventPropertyConstants.EventNotificationId].Value<int>()
            });

            if (!eventData.PropertyValues[EventPropertyConstants.DocumentName].IsNullOrEmpty())
            {

                parameters.Add(new OdbcParameter
                {
                    ParameterName = "DocumentName",
                    OdbcType = OdbcType.VarChar,
                    Size = 128,
                    Value = eventData.PropertyValues[EventPropertyConstants.DocumentName]
                });
            }
            else
            {
                parameters.Add(new OdbcParameter
                {
                    ParameterName = "DocumentName",
                    OdbcType = OdbcType.VarChar,
                    Size = 128,
                    Value = string.Empty
                });
            }
            ClientDatabaseManager.ExecuteDatabaseStoredProcedure("{CALL " + storedProcedureName + " (?, ?, ?, ?, ?)}", parameters);
        }

        /// <summary>
        /// Process the Queued Job with the Notification Events
        /// </summary>
        /// <param name="notificationEvent"></param>
        [SendEmailFailure()]
        public static async Task ProcessPostedEvent(JObject notificationEvent)
        {
            try
            {
                using (var dbContext = new CampusLogicContext())
                {
                    var eventData = new EventNotificationData(notificationEvent);

                    int eventNotificationId = eventData.PropertyValues[EventPropertyConstants.EventNotificationId].Value<int>();

                    var eventHandler = campusLogicConfigSection.EventNotifications.Cast<EventNotificationHandler>().FirstOrDefault(x => x.EventNotificationId == eventNotificationId) ??
                                       campusLogicConfigSection.EventNotifications.Cast<EventNotificationHandler>().FirstOrDefault(x => x.EventNotificationId == 0); //If no specific handler was provided check for the catch all handler

                    if (eventHandler != null)
                    {
                        //Enhance the Event Data for certain situations
                        //See if event notification type has callbackulr or callback file url
                        var eventNotificationDefinition = EventPropertyService.GetCallbackUrls(eventNotificationId);
                        //if so make call for api
                        if (!string.IsNullOrEmpty(eventNotificationDefinition.CallbackEndpoint) || !string.IsNullOrEmpty(eventNotificationDefinition.CallbackFileEndpoint))
                        {
                            if (eventNotificationDefinition.ProductId == null)
                            {
                                LogManager.ErrorLog($"There was no product ID for event notificaiton id {eventNotificationId}, but there was a callbackURL {eventNotificationDefinition.CallbackEndpoint} or callbackFileURL {eventNotificationDefinition.CallbackFileEndpoint}");
                            }
                            if(!string.IsNullOrEmpty(eventNotificationDefinition.CallbackEndpoint))
                            {
                                var callbackURL = eventData.ReplaceStringProperties(eventNotificationDefinition.CallbackEndpoint);
                                JObject callbackInfo = null;

                                //SV was the first product, so we have this one special caveat for this callback
                                if (eventNotificationId == 105)
                                {
                                    var tranCategory = (TransactionCategory)eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId].Value<int>();
                                    if (tranCategory != TransactionCategory.Verification && tranCategory != TransactionCategory.Generic)
                                    {
                                        callbackInfo = await ExecuteCallback(eventNotificationDefinition, callbackURL);
                                        //Another special SV caveat, previously we were translating this (no idea why) and to ensure this backward compatible
                                        //we have to do the same
                                        if (callbackInfo[EventPropertyConstants.OutcomeId].Value<int?>() != null)
                                        {
                                            eventData.PropertyValues[EventPropertyConstants.TransactionOutcomeId] = ((TransactionOutcome)Enum.ToObject(typeof(TransactionOutcome), callbackInfo[EventPropertyConstants.OutcomeId].Value<int>())).ToString();
                                        }
                                    }
                                }
                                else
                                {
                                    callbackInfo = await ExecuteCallback(eventNotificationDefinition, callbackURL);
                                }
                                if (callbackInfo != null)
                                {
                                    //bit of a hack but we are passing back our student id in these callbacks,
                                    //and it is overriding the student id property from the original call(the school ID)
                                    //removing from the callback so it doesn't override an existing property
                                    if (callbackInfo["StudentId"] != null)
                                    {
                                        callbackInfo.Property("StudentId").Remove();
                                    }
                                    eventData.PropertyValues.Merge(callbackInfo, new JsonMergeSettings { MergeArrayHandling = MergeArrayHandling.Concat });
                                }

                            }
                            if (!string.IsNullOrEmpty(eventNotificationDefinition.CallbackFileEndpoint))
                            {
                                eventNotificationDefinition.CallbackFileEndpoint = eventData.ReplaceStringProperties(eventNotificationDefinition.CallbackFileEndpoint);
                            }

                        }


                        // populate PropertyValues with all the values that have been gathered
                        eventData.PopulatePropertyValues();

                        //Now Send it to the correct handler
                        if (eventHandler.HandleMethod == "DatabaseCommandNonQuery")
                        {
                            DatabaseCommandNonQueryHandler(eventData, eventHandler.DbCommandFieldValue);
                        }
                        else if (eventHandler.HandleMethod == "DatabaseStoredProcedure")
                        {
                            DatabaseStoredProcedure(eventData, eventHandler.DbCommandFieldValue);
                        }
                        else if (eventHandler.HandleMethod == "DocumentRetrieval")
                        {
                            await DocumentRetrievalHandler(eventData, eventNotificationDefinition);
                        }
                        else if (eventHandler.HandleMethod == "DocumentRetrievalAndStoredProc")
                        {
                            await DocumentRetrievalHandler(eventData, eventNotificationDefinition);
                            DatabaseStoredProcedure(eventData, eventHandler.DbCommandFieldValue);
                        }
                        else if (eventHandler.HandleMethod == "DocumentRetrievalAndNonQuery")
                        {
                            await DocumentRetrievalHandler(eventData, eventNotificationDefinition);
                            DatabaseCommandNonQueryHandler(eventData, eventHandler.DbCommandFieldValue);
                        }
                        else if (eventHandler.HandleMethod == "FileStore")
                        {
                            FileStoreHandler(eventData);
                        }
                        else if (eventHandler.HandleMethod == "FileStoreAndDocumentRetrieval")
                        {
                            await DocumentRetrievalHandler(eventData, eventNotificationDefinition);
                            //SV-2383: Moving the File Store handler *after* the Document Retrieval Handler so that if the Doc handler fails, it won't log the same event on retry.
                            FileStoreHandler(eventData);
                        }
                        else if (eventHandler.HandleMethod == "AwardLetterPrint")
                        {
                            LogManager.InfoLog("detect this is the AwardLetterPrint");
                            await AwardLetterDocumentRetrievalHandler(eventData, eventNotificationDefinition);
                        }
                        else if (eventHandler.HandleMethod == "BatchProcessingAwardLetterPrint")
                        {
                            LogManager.InfoLog("detect this is the BatchProcessingAwardLetterPrint");
                            BatchProcessRetrievalHandler(ConfigConstants.AwardLetterPrintBatchType, eventHandler.BatchName, eventData);
                        }
                        else if (eventHandler.HandleMethod == "ApiIntegration")
                        {
                            ApiIntegrationsHandler(eventHandler.ApiEndpointName, eventData);
                        }
                        else if (eventHandler.HandleMethod == "PowerFAIDS")
                        {
                            PowerFaidsHandler(eventData);
                        }
                    }

                    //Update the received event with a processed date time
                    var eventId = eventData.PropertyValues[EventPropertyConstants.Id].Value<string>();
                    var storedEvent = dbContext.ReceivedEvents.FirstOrDefault(x => x.Id == eventId);
                    if (storedEvent != null)
                    {
                        storedEvent.ProcessedDateTime = DateTime.UtcNow;
                        dbContext.SaveChanges();
                    }
                }
            } 
            catch (Exception ex)
            {
                //Log here any exceptions
                LogManager.ErrorLogFormat("DataService ProcessPostedEvent Error: {0}", ex);
                throw;
            }
        }

        private static async Task<JObject> ExecuteCallback( EventNotificationDefinition eventNotificationDefinition, string callbackURL)
        {
            var manager = new CallbackManager();
            return await manager.GetCallbackInfo(callbackURL, (Guid)eventNotificationDefinition.ProductId);
        }

        /// <summary>
        /// Handles PowerFAIDS integration.
        /// Will either queue up the eventData to be written to a file later
        /// or save the single record as an XML file.
        /// </summary>
        /// <param name="eventData"></param>
        private static void PowerFaidsHandler(EventNotificationData eventData)
        {
            try
            {
                // Get the settings the user has defined for PowerFAIDS
                var generalSettings = campusLogicConfigSection.PowerFaidsSettings;

                var awardYearToken = eventData.PropertyValues[EventPropertyConstants.AwardYear].Value<string>();

                if (!string.IsNullOrEmpty(awardYearToken))
                {
                    awardYearToken = awardYearToken.Split('-')[0];
                }

                var eventSettings = campusLogicConfigSection.PowerFaidsSettings.PowerFaidsSettingCollectionConfig.GetPowerFaidsSettingList();

                var eventSetting = eventSettings
                    .FirstOrDefault(e => (eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId]?.Value<string>() == null
                            ? string.Empty
                            : eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId]?.Value<string>()) == e.TransactionCategory
                        && e.Event == eventData.PropertyValues[EventPropertyConstants.EventNotificationId].Value<string>());

                if (eventSetting != null)
                {
                    var recordToProcess = new PowerFaidsDto()
                    {
                        EventId = eventData.PropertyValues[EventPropertyConstants.Id].Value<string>(),
                        AwardYearToken = awardYearToken,
                        AlternateId = eventData.PropertyValues[EventPropertyConstants.StudentId].Value<string>(),
                        FilePath = generalSettings.FilePath,
                        Outcome = eventSetting.Outcome,
                        ShortName = eventSetting.ShortName,
                        RequiredFor = eventSetting.RequiredFor,
                        Status = eventSetting.Status,
                        EffectiveDate = eventData.PropertyValues[EventPropertyConstants.DateTimeUtc].Value<DateTime>().ToString("yyyy-MM-dd"),
                        DocumentLock = eventSetting.DocumentLock,
                        VerificationOutcome = eventSetting.VerificationOutcome,
                        VerificationOutcomeLock = eventSetting.VerificationOutcomeLock
                    };

                    if (generalSettings.IsBatch.Value == false)
                    {
                        try
                        {
                            PowerFaidsService.ProcessPowerFaidsRecords(new List<PowerFaidsDto>() { recordToProcess });
                        }
                        catch (Exception)
                        {
                            throw new Exception($"Error occurred while processing PowerFAIDS record. EventId: {recordToProcess.EventId}");
                        }
                    }
                    else
                    {
                        var json = JsonConvert.SerializeObject(recordToProcess).Replace("'", "''");

                        using (var dbContext = new CampusLogicContext())
                        {
                            // Insert the record into the PowerFaidsRecord table so that it can be processed by the Automated PowerFAIDS job.
                            dbContext.Database.ExecuteSqlCommand($"INSERT INTO [dbo].[PowerFaidsRecord]([Json], [ProcessGuid]) VALUES('{json}', NULL)");
                        }
                    }
                }
                else
                {
                    throw new Exception($"Error occured while processing PowerFAIDS record. Cannot find mapping for Event Notification: {eventData.PropertyValues[EventPropertyConstants.EventNotificationId].Value<string>()} and Transaction Category: {eventData.PropertyValues[EventPropertyConstants.SvTransactionCategoryId].Value<string>()}");
                }
            }
            catch (Exception e)
            {
                NotificationService.ErrorNotification("PowerFAIDS", e);
                throw;
            }
        }

        /// <summary>
        /// Handles events that require the system to execute a non-query database command
        /// </summary>
        /// <param name="eventData"></param>
        /// <param name="databaseCommand"></param>
        private static void DatabaseCommandNonQueryHandler(EventNotificationData eventData, string databaseCommand)
        {
            var commandText = eventData.ReplaceStringProperties(databaseCommand);
            ClientDatabaseManager.ExecuteDatabaseNonQuery(commandText);
        }

        /// <summary>
        /// Handles events that require the system to execute a database stored procedure based on the configuration.
        /// </summary>
        /// <param name="eventData"></param>
        /// <param name="storedProcedureName"></param>
        private static void DatabaseStoredProcedure(EventNotificationData eventData, string storedProcedureName)
        {
            var storedProcedureSettings = campusLogicConfigSection.StoredProcedures.GetStoredProcedure(storedProcedureName);
            if (storedProcedureSettings != null)
            {
                // Parse parameters based on config.
                List<OdbcParameter> parameters =
                    storedProcedureSettings.GetParameters().Select(p => ParseParameter(p, eventData)).ToList();

                //Adding logging in case client experiences weird argument error, we can better determine what we are trying to pass
                //LogManager.InfoLog($"Parameters to be pass into database: { String.Join(", ", parameters.Select(x => x.ParameterName + ": " + x.Value.ToString() + " - DataType: " + Enum.GetName(typeof(OdbcType), x.OdbcType)))}");

                // For each parameter, need to add a placeholder "?" in the sql command.  
                // This is just part of the ODBC syntax.
                string placeholders = string.Join(",", parameters.Select(p => "?").ToArray());
                if (placeholders.Length > 0)
                {
                    placeholders = " (" + placeholders + ")";
                }

                // Final output should look like this: {CALL sproc_name (?, ?, ?)}
                string command = $"{{CALL {storedProcedureSettings.Name}{placeholders}}}";

                //LogManager.InfoLog(command);
                ClientDatabaseManager.ExecuteDatabaseStoredProcedure(command, parameters);
            }
            else
            {
                //Static db procedure
                GetDefaultDatabaseProcedure(eventData, storedProcedureName);
            }
        }

        /// <summary>
        /// Builds an Odbc Parameter object from the arguments.
        /// </summary>
        /// <param name="parameterElement">Parameter definition from the config.</param>
        /// <param name="data">The event notification to pull the parameter's value from.</param>
        /// <returns></returns>
        private static OdbcParameter ParseParameter(ParameterElement parameterElement, EventNotificationData data)
        {
            try
            {
                // Need to convert the string representation of the type to the actual
                // enum OdbcType.
                string[] odbcTypes = Enum.GetNames(typeof(OdbcType));
                string odbcTypeMatch = odbcTypes.First(t => t.Equals(parameterElement.DataType, StringComparison.InvariantCultureIgnoreCase));
                OdbcType odbcType = (OdbcType)Enum.Parse(typeof(OdbcType), odbcTypeMatch);

                // Get property from the data using the property DisplayName (source)
                object value = HttpUtility.HtmlDecode(data.GetValueByDisplayName(parameterElement.Source));

                // Build return object.
                var parameter = new OdbcParameter
                {
                    ParameterName = parameterElement.Name,
                    OdbcType = odbcType,
                    Size = parameterElement.LengthAsInt,
                    Value = value == null ? DBNull.Value : (string)value == string.Empty && odbcType == OdbcType.Int ? 0 : value
                };

                return parameter;
            }
            catch (Exception ex)
            {
                throw new Exception("Failed to parse parameter.", ex);
            }
        }

        /// <summary>
        /// Handles events that require the document retrieval
        /// This will get the metadata and pull the documents and optionally create an index file for the documents
        /// </summary>
        /// <param name="eventData"></param>
        private static async Task DocumentRetrievalHandler(EventNotificationData eventData, EventNotificationDefinition eventNotificationDefinition)
        {
            var manager = new DocumentManager();
            var callbackManager = new CallbackManager();

            if (eventNotificationDefinition.ProductId == null)
            {
                LogManager.ErrorLogFormat("DataService ProcessPostedEvent Missing Product ID for File Callback URL for EventId : {0}", eventData.PropertyValues[EventPropertyConstants.Id].Value<string>());
                return;
            }
            if (eventNotificationDefinition.CallbackFileEndpoint.IsNullOrWhiteSpace())
            {
                LogManager.ErrorLogFormat("DataService ProcessPostedEvent Missing File Callback URL for EventId : {0}", eventData.PropertyValues[EventPropertyConstants.Id].Value<string>());
                return;
            }

            //Get and Store the Documents
            var fileStream = await callbackManager.GetCallbackFile(eventNotificationDefinition.CallbackFileEndpoint, (Guid)eventNotificationDefinition.ProductId);
            var dataFiles = manager.ProcessDocumentFiles(eventData, fileStream);

            //If required create an index file
            if (dataFiles.Any() && (campusLogicConfigSection.DocumentSettings.IndexFileEnabled ?? false))
            {
                manager.CreateDocumentsIndexFile(dataFiles, eventData);
            }
        }

        /// <summary>
        /// Used for getting a batch of AL PDFs for printing.
        /// </summary>
        /// <param name="eventData"></param>
        private static void BatchProcessRetrievalHandler(string type, string name, EventNotificationData eventData)
        {
            var message = eventData.PropertyValues.ToString().Replace("'", "''");

            using (var dbContext = new CampusLogicContext())
            {
                //Insert the event into the BatchProcessRecord table so that it can be processed by the Automated Batch Process job.
                dbContext.Database.ExecuteSqlCommand($"INSERT INTO [dbo].[BatchProcessRecord]([Type], [Name], [Message], [ProcessGuid], [RetryCount], [RetryUpdatedDate]) VALUES('{type}', '{name}', '{message}', NULL, NULL, NULL)");
            }
        }

        /// <summary>
        /// Used to get PDF
        /// version of AL 
        /// for printers
        /// </summary>
        /// <param name="eventData"></param>
        private static async Task AwardLetterDocumentRetrievalHandler(EventNotificationData eventData, EventNotificationDefinition eventNotificationDefinition)
        {
            var manager = new DocumentManager();
            var callbackManager = new CallbackManager();

            if (eventData.PropertyValues[EventPropertyConstants.AlRecordId].IsNullOrEmpty())
            {
                LogManager.ErrorLogFormat("DataService ProcessPostedEvent Missing Record Id for Event Id: {0}", eventData.PropertyValues[EventPropertyConstants.Id].Value<string>());
                return;
            }

            var fileStream = await callbackManager.GetCallbackFile(eventNotificationDefinition.CallbackFileEndpoint, (Guid)eventNotificationDefinition.ProductId);
            //Get and Store the Documents
            manager.ProcessAwardLetterDocumentFiles(eventData, fileStream);
        }

        /// <summary>
        /// The File Store Handler. Surprise!
        /// </summary>
        public static void FileStoreHandler(EventNotificationData eventData)
        {
            try
            {
                using (var dbContext = new CampusLogicContext())
                {
                    var dataToSerialize = eventData.PropertyValues.ToString().Replace("'", "''");
                    //Insert the event into the EventNotification table so that it can be processed by the Automated File Store job.
                    dbContext.Database.ExecuteSqlCommand($"INSERT INTO [dbo].[EventNotification]([EventNotificationId], [Message], [CreatedDateTime], [ProcessGuid]) VALUES({eventData.PropertyValues[EventPropertyConstants.EventNotificationId].Value<int>()}, '{dataToSerialize}', GetUtcDate(), NULL)");
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLog($"An error occured when attempting to handle the event data for file store: {ex}");
            }
        }

        private static string GetJsonFromNameValueCollection(NameValueCollection data)
        {
            return JsonConvert.SerializeObject(data.AllKeys.ToDictionary(k => k, k => data[k]));
        }

        /// <summary>
        /// Converts a collection of parameters and their values into HttpContent.
        /// </summary>
        /// <param name="eventParams"></param>
        /// <param name="mimeType"></param>
        /// <returns></returns>
        private static StringContent GetHttpContent(NameValueCollection eventParams, string mimeType)
        {
            return new StringContent(GetJsonFromNameValueCollection(eventParams), Encoding.UTF8, mimeType);
        }

        /// <summary>
        /// Retrieves an access token via OAuth 2.0 protocol.
        /// </summary>
        /// <param name="apiIntegration"></param>
        /// <returns></returns>
        private static async Task<string> GetOauth2TokenAsync(ApiIntegrationElement apiIntegration)
        {
            try
            {
                using (var httpClient = new System.Net.Http.HttpClient())
                {
                    httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic",
                        Convert.ToBase64String(
                            Encoding.ASCII.GetBytes(
                                $"{apiIntegration.Username}:{apiIntegration.Password}")));

                    var body = "grant_type=client_credentials";

                    StringContent theContent = new StringContent(body, Encoding.UTF8, "application/x-www-form-urlencoded");

                    HttpResponseMessage response = await httpClient.PostAsync(new Uri(apiIntegration.TokenService), theContent).ConfigureAwait(false);

                    if (response.IsSuccessStatusCode)
                    {
                        var responseJson = await response.Content.ReadAsStringAsync();
                        return (string)JObject.Parse(responseJson)["access_token"];
                    }
                    else
                    {
                        throw new Exception("Invalid response");
                    }
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("DataService GetOauth2TokenAsync Error: {0}", ex);
                throw;
            }
        }

        private static void LogRequest(HttpResponseMessage response, NameValueCollection data)
        {
            string request = $"{response.RequestMessage.Method} {response.RequestMessage.RequestUri} Status Code: {(int)response.StatusCode}, Version: {response.Version}, Data: {GetJsonFromNameValueCollection(data)}, Headers: {{ {response.RequestMessage.Headers} }}";

            LogManager.InfoLog(string.Format("API Integration - Request: {0}", request));
        }

        /// <summary>
        /// Handles an HTTP request for an endpoint.
        /// </summary>
        /// <param name="endpointName"></param>
        /// <param name="eventData"></param>
        private static async void ApiIntegrationsHandler(string endpointName, EventNotificationData eventData)
        {
            try
            {
                using (var httpClient = new System.Net.Http.HttpClient())
                {
                    var apiEndpoint = campusLogicConfigSection.ApiEndpoints.GetEndpoints().FirstOrDefault(e => e.Name == endpointName);
                    if (apiEndpoint == null)
                    {
                        throw new Exception("Invalid API Endpoint");
                    }

                    var apiIntegration = campusLogicConfigSection.ApiIntegrations.GetApiIntegrations().FirstOrDefault(a => a.ApiId == apiEndpoint.ApiId);
                    if (apiIntegration == null)
                    {
                        throw new Exception("Invalid API Integration");
                    }

                    httpClient.BaseAddress = new Uri(apiIntegration.Root);

                    // Allow 5 minutes for response
                    httpClient.Timeout = new TimeSpan(0, 5, 0);

                    // Custom header for API service to track requests
                    var eventId = eventData.PropertyValues[EventPropertyConstants.Id].Value<string>();
                    httpClient.DefaultRequestHeaders.Add("EventId", eventId);

                    var authType = apiIntegration.Authentication;
                    switch (authType)
                    {
                        case ConfigConstants.Basic:
                            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic",
                                Convert.ToBase64String(
                                    Encoding.ASCII.GetBytes(
                                        $"{apiIntegration.Username}:{apiIntegration.Password}")));
                            break;
                        case ConfigConstants.OAuth2:
                            var oauth2Token = await GetOauth2TokenAsync(apiIntegration);
                            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", oauth2Token);
                            break;
                        case ConfigConstants.OAuth_WRAP:
                            var oauthwrapToken = await CredentialsManager.GetOauthWrapTokenAsync(apiIntegration);
                            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("WRAP", "access_token=\"" + oauthwrapToken + "\"");
                            break;
                        case ConfigConstants.Ethos:
                            var ethosToken = await CredentialsManager.GetEthosAuthTokenAsync(apiIntegration);
                            httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", ethosToken);
                            break;
                        default:
                            break;
                    }

                    // use the eventdata and its values to link up to the endpoint's parameters
                    JArray parameterMappings;
                    try
                    {
                        parameterMappings = JArray.Parse(apiEndpoint.ParameterMappings);
                    }
                    catch (Exception)
                    {
                        LogManager.ErrorLog("apiEndpoint.ParameterMappings could not be parsed");

                        throw;
                    }

                    if (!parameterMappings.Any())
                    {
                        throw new Exception("No parameter mappings were found");
                    }

                    var eventParams = new NameValueCollection();
                    var changeNotificationContent = new JObject();

                    // foreach mapping, get event property, find its corresponding eventdata, get that eventdata's value, attach it to the parameter in mapping
                    foreach (JToken jToken in parameterMappings)
                    {
                        var mapping = (JObject)jToken;

                        // This retrieves the "DisplayName" value of the EventProperty
                        var mappingDisplayName = mapping["eventData"].Value<string>();

                        // PM-631: For Ethos requests, the POST content object structure changes. Need to maintain property types.
                        if (authType == ConfigConstants.Ethos)
                        {
                            var eventValue = eventData.GetValueByDisplayNameForChangeNotification(mappingDisplayName);
                            changeNotificationContent.Add(mapping["parameter"].Value<string>(), eventValue);
                        }
                        else
                        {
                            // SV-3872 Convert to the "Name" value of the EventProperty
                            // In cases of JS formula, this will apply that value instead
                            var eventValue = eventData.GetValueByDisplayName(mappingDisplayName);
                            eventParams.Add(mapping["parameter"].Value<string>(), eventValue);
                        }
                    }

                    HttpResponseMessage response = new HttpResponseMessage(HttpStatusCode.OK);

                    var endpoint = apiEndpoint.Endpoint;
                    var url = apiIntegration.Root + endpoint;

                    switch (apiEndpoint.Method)
                    {
                        case WebRequestMethods.Http.Get:
                            var list = new List<string>();

                            foreach (string key in eventParams.AllKeys)
                            {
                                string[] eventParamsKeyValues = eventParams.GetValues(key);

                                if (eventParamsKeyValues == null)
                                {
                                    throw new NullReferenceException($"EventParams for key:{key} returned null");
                                }

                                foreach (string value in eventParamsKeyValues)
                                {
                                    list.Add($"{HttpUtility.UrlEncode(key)}={HttpUtility.UrlEncode(value)}");
                                }
                            }

                            string[] array = list.ToArray();
                            endpoint += "?" + string.Join("&", array);
                            response = await httpClient.GetAsync(endpoint);

                            break;
                        case WebRequestMethods.Http.Post:
                            response = await HandleApiPostAsync(httpClient, eventId, eventParams, changeNotificationContent, apiEndpoint, apiIntegration.Authentication);
                            break;
                        case WebRequestMethods.Http.Put:
                            response = await httpClient.PutAsync(endpoint, GetHttpContent(eventParams, apiEndpoint.MimeType));
                            break;
                        default:
                            break;
                    }

                    LogRequest(response, eventParams);

                    if (!response.IsSuccessStatusCode)
                    {
                        throw new Exception("Invalid response - " + (int)response.StatusCode + " " + response.ReasonPhrase + " - Attempted to call " + apiEndpoint.Method + " " + url);
                    }
                }
            }
            catch (Exception e)
            {
                LogManager.ErrorLogFormat("DataService ApiIntegrationsHandler Error: {0}", e);
                throw;
            }
        }

        /// <summary>
        /// Creates and handles a post request based on authentication type (basic, ethos)
        /// </summary>
        /// <param name="httpClient"></param>
        /// <param name="eventId"></param>
        /// <param name="eventParams"></param>
        /// <param name="changeNotificationContent"></param>
        /// <param name="apiEndpoint"></param>
        /// <param name="authenticationMethod"></param>
        /// <returns></returns>
        private static async Task<HttpResponseMessage> HandleApiPostAsync(System.Net.Http.HttpClient httpClient, string eventId, NameValueCollection eventParams,
                                                                            JObject changeNotificationContent, ApiIntegrationEndpointElement apiEndpoint, string authenticationMethod)
        {
            StringContent content;
            if (authenticationMethod == ConfigConstants.Ethos)
            {
                // PM-631: If this is an Ellucian Ethos Integration, we have to wrap the event data in the appropriate schema
                var changeNotification = new ChangeNotificationData
                {
                    Resource = new Resource
                    {
                        Name = ConfigConstants.EthosApplicationName,
                        Id = new Guid(eventId),
                    },
                    Operation = "created",
                    ContentType = "resource-representation",
                    Content = changeNotificationContent
                };
                // Expects an array for the body
                DefaultContractResolver contractResolver = new DefaultContractResolver { NamingStrategy = new CamelCaseNamingStrategy(true, false) };
                var postBody = JsonConvert.SerializeObject(new[] { changeNotification }, new JsonSerializerSettings
                {
                    ContractResolver = contractResolver,
                    Formatting = Formatting.None
                });
                content = new StringContent(postBody, Encoding.UTF8, apiEndpoint.MimeType);
            }
            else
            {
                // Non-Ellucian auth flow
                content = GetHttpContent(eventParams, apiEndpoint.MimeType);
            }

            return await httpClient.PostAsync(apiEndpoint.Endpoint, content);
        }

        /// <summary>
        /// Data Cleanup - Run on a scheduled basis.  Configured in the Startup.cs
        /// Removes old records from the ReceivedEvents and Logging to keep the database size down
        /// </summary>
        public static void DataCleanup()
        {
            try
            {
                var purgeReceivedEventsAfterDays = String.IsNullOrWhiteSpace(ConfigurationManager.AppSettings["PurgeReceivedEventsAfterDays"]) ? 30 : Convert.ToInt32(ConfigurationManager.AppSettings["PurgeReceivedEventsAfterDays"]);
                var purgeLogRecordsAfterDays = String.IsNullOrWhiteSpace(ConfigurationManager.AppSettings["PurgeLogRecordsAfterDays"]) ? 30 : Convert.ToInt32(ConfigurationManager.AppSettings["PurgeLogRecordsAfterDays"]);
                var purgeNotificaitonLogRecordsAfterDays = String.IsNullOrWhiteSpace(ConfigurationManager.AppSettings["PurgeNotificationLogRecordsAfterDays"]) ? 30 : Convert.ToInt32(ConfigurationManager.AppSettings["PurgeNotificationLogRecordsAfterDays"]);

                using (var dbContext = new CampusLogicContext())
                {
                    //Clean up log records older then configured number of days
                    dbContext.Database.ExecuteSqlCommand("Delete from [Log] where [Date] < DateAdd(d, -" + purgeLogRecordsAfterDays + ", GetUtcDate())");

                    //Clean up notification log records older then configured number of days
                    dbContext.Database.ExecuteSqlCommand("Delete from [NotificationLog] where [DateSent] < DateAdd(d, -" + purgeNotificaitonLogRecordsAfterDays + ", GetUtcDate())");

                    //Clean up Received event records older then configured number of days
                    dbContext.Database.ExecuteSqlCommand("Delete from [ReceivedEvent] where [ReceivedDateTime] < DateAdd(d, -" + purgeReceivedEventsAfterDays + ", GetUtcDate())");

                    //Clean up event notifications logged in the EventNotification table
                    dbContext.Database.ExecuteSqlCommand("DELETE FROM [dbo].[EventNotification] WHERE [CreatedDateTime] < DateAdd(d, -" + purgeReceivedEventsAfterDays + ", GetUtcDate()) AND [ProcessGuid] IS NOT NULL");
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("DataService DataCleanup Error: {0}", ex);
            }

        }

        /// <summary>
        /// Gets a list of the log records
        /// </summary>
        /// <returns></returns>
        public static List<Log> LogRecords(int count)
        {
            using (var dbContext = new CampusLogicContext())
            {
                return dbContext.Logs.OrderByDescending(x => x.Date).Take(count).ToList();
            }
        }

        /// <summary>
        /// Gets a list of the received event records
        /// </summary>
        /// <returns></returns>
        public static List<ReceivedEvent> EventRecords(int count)
        {
            using (var dbContext = new CampusLogicContext())
            {
                return dbContext.ReceivedEvents.OrderByDescending(x => x.ReceivedDateTime).Take(count).ToList();
            }
        }

        /// <summary>
        /// Logs the notification in the notification log table
        /// </summary>
        /// <param name="notificationData"></param>
        public static void LogNotification(NotificationData notificationData)
        {
            try
            {
                if (campusLogicConfigSection.SMTPSettings.NotificationsEnabled ?? false)
                {
                    using (var dbContext = new CampusLogicContext())
                    {
                        dbContext.NotificationLogs.Add(new NotificationLog()
                        {
                            Recipients = notificationData.MailMessage.To.ToString(),
                            Sender = notificationData.MailMessage.From.ToString(),
                            DateSent = DateTime.UtcNow,
                            Subject = notificationData.MailMessage.Subject,
                            Body = notificationData.MailMessage.Body,
                            FailedSending = !notificationData.SendCompleted ?? false,
                        });

                        dbContext.SaveChanges();
                    }
                }
            }
            catch (Exception ex)
            {
                //Log here any exceptions
                LogManager.ErrorLogFormat("DataService LogNotification Error logging recently sent email: {0}", ex);
            }
        }
    }
}