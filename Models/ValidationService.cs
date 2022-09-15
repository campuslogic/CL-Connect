using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net;
using System.Net.Configuration;
using System.Net.Http;
using System.Threading.Tasks;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using Microsoft.Ajax.Utilities;

namespace CampusLogicEvents.Web.Models
{
    public static class ValidationService
    {
        
        /// <summary>
        /// Validate all of the enabled sections
        /// in the appropriate order
        /// NOTE: ensure if your section
        /// depends on another that you nest the sections
        /// appropriately
        /// </summary>
        /// <param name="configurationModel"></param>
        /// <returns></returns>
        public static async Task<ConfigurationValidationModel> ValidateAll(ConfigurationModel configurationModel)
        {
            var response = new ConfigurationValidationModel();
            response.EnvironmentValid = ValidateEnvironment(configurationModel.AppSettingsSection).IsSuccessStatusCode;
            if (response.EnvironmentValid)
            {
                HttpResponseMessage validatedResponse = await ValidateApiCredentials(configurationModel.AppSettingsSection, configurationModel.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadEnabled ?? false);
                response.ApiCredentialsValid = validatedResponse.IsSuccessStatusCode;
                if (configurationModel.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadEnabled ?? false)
                {
                    response.AwardLetterUploadValid = ValidateAwardLetterUploadSettings(configurationModel.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadFilePath).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.DataFileUploadSettings.DataFileUploadEnabled ?? false)
                {
                    response.DataFileUploadValid = ValidateDataFileUploadSettings(configurationModel.CampusLogicSection.DataFileUploadSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.SMTPSettings.NotificationsEnabled ?? false)
                {
                    response.SMTPValid = ValidateSMTPSettings(configurationModel.CampusLogicSection.SMTPSettings, configurationModel.SmtpSection).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.ISIRUploadSettings.ISIRUploadEnabled ?? false)
                {
                    response.ISIRUploadValid = ValidateISIRUploadSettings(configurationModel.CampusLogicSection.ISIRUploadSettings.ISIRUploadFilePath).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.ISIRCorrectionsSettings.CorrectionsEnabled ?? false)
                {
                    response.ISIRCorrectionsValid = ValidateIsirCorrectionSettings(configurationModel.CampusLogicSection.ISIRCorrectionsSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.DocumentSettings.DocumentsEnabled ?? false)
                {
                    response.DocumentSettingsValid = ValidateDocumentSettings(configurationModel.CampusLogicSection.DocumentSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.DocumentImportSettings.Enabled)
                {
                    response.DocumentImportsValid = ValidateDocumentImportSettings(configurationModel.CampusLogicSection.DocumentImportSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.FileStoreSettings.FileStoreEnabled ?? false)
                {
                    response.FileStoreSettingsValid = ValidateFileStoreSettings(configurationModel.CampusLogicSection.FileStoreSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.AwardLetterPrintSettings.AwardLetterPrintEnabled ?? false)
                {
                    response.AwardLetterPrintSettingsValid = ValidateAwardLetterPrintSettings(configurationModel.CampusLogicSection.AwardLetterPrintSettings).IsSuccessStatusCode;
                }
                if (configurationModel.CampusLogicSection.BatchProcessingEnabled ?? false)
                {
                    response.BatchProcessingSettingsValid = ValidateBatchProcessingSettings(configurationModel).IsSuccessStatusCode;
                    var batchNamesDictionary = GetBatchNameLists(configurationModel.CampusLogicSection.EventNotificationsList, configurationModel.CampusLogicSection.BatchProcessingTypesList);
                    response.InvalidBatchName = !ValidateBatchNames(batchNamesDictionary);
                    response.MissingBatchName = !ValidateMissingBatchNames(batchNamesDictionary);
                }
                if (configurationModel.CampusLogicSection.ApiIntegrationsEnabled ?? false)
                {
                    response.ApiIntegrationsValid = ValidateApiIntegrations(configurationModel).IsSuccessStatusCode;
                    var dictionary = GetApiEndpointNameLists(configurationModel.CampusLogicSection.EventNotificationsList, configurationModel.CampusLogicSection.ApiEndpointsList);
                    response.MissingApiEndpointName = !ValidateMissingApiEndpointNames(dictionary);
                }
                if (configurationModel.CampusLogicSection.FileDefinitionsEnabled ?? false)
                {
                    response.FileDefinitionSettingsValid = ValidateFileDefinitionSettings(configurationModel).IsSuccessStatusCode;
                    response.ImproperFileDefinitions = CheckIfImproperFileDefinitions(configurationModel);
                }
                if (configurationModel.CampusLogicSection.PowerFaidsEnabled ?? false)
                {
                    response.PowerFaidsSettingsValid = ValidatePowerFaidsSettings(configurationModel).IsSuccessStatusCode;
                }

                //if any of the features that has file paths involved are enabled validate file path uniqueness
                if ((configurationModel.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadEnabled ?? false)
                    || (configurationModel.CampusLogicSection.ISIRUploadSettings.ISIRUploadEnabled ?? false)
                    || (configurationModel.CampusLogicSection.ISIRCorrectionsSettings.CorrectionsEnabled ?? false)
                    || (configurationModel.CampusLogicSection.DocumentSettings.DocumentsEnabled ?? false)
                    || (configurationModel.CampusLogicSection.FileStoreSettings.FileStoreEnabled ?? false)
                    || (configurationModel.CampusLogicSection.AwardLetterPrintSettings.AwardLetterPrintEnabled ?? false)
                    || (configurationModel.CampusLogicSection.BatchProcessingEnabled ?? false)
                    || (configurationModel.CampusLogicSection.DataFileUploadSettings.DataFileUploadEnabled ?? false))
                {
                    response.DuplicatePath = !ValidatePathsUnique(configurationModel);
                }

                if (!(configurationModel.CampusLogicSection.EventNotificationsEnabled ?? false) || configurationModel.CampusLogicSection.EventNotificationsList.Count == 0)
                {
                    return response;
                }

                response.DuplicateEvent = !ValidateEventNotificationsUnique(configurationModel.CampusLogicSection.EventNotificationsList);
                response.ConnectionStringValid = ValidateConnectionStringValid(configurationModel.CampusLogicSection.EventNotificationsList, configurationModel.CampusLogicSection.ClientDatabaseConnection.ConnectionString);                
            }

            return response;
        }
        
        public static bool FileDefinitionExistsForName(string name, IList<FileDefinitionDto> fileDefinitions)
        {
            foreach (var fileDefinition in fileDefinitions)
            {
                if (fileDefinition.Name == name)
                {
                    return true;
                }
            }

            return false;
        }

        public static bool CheckIfImproperFileDefinitions(ConfigurationModel configurationModel)
        {
            var campusLogicSection = configurationModel.CampusLogicSection;
            var fileDefinitions = campusLogicSection.FileDefinitionsList;

            var fileStoreSettings = campusLogicSection.FileStoreSettings;
            if (fileStoreSettings.FileStoreEnabled ?? false)
            {
                if (!FileDefinitionExistsForName(fileStoreSettings.FileDefinitionName, fileDefinitions))
                {
                    return true;
                }
            }

            var documentSettings = campusLogicSection.DocumentSettings;
            if (documentSettings.DocumentsEnabled ?? false)
            {
                if (documentSettings.IndexFileEnabled ?? false)
                {
                    if (!FileDefinitionExistsForName(documentSettings.FileDefinitionName, fileDefinitions))
                    {
                        return true;
                    }
                }
            }

            if (campusLogicSection.BatchProcessingEnabled ?? false)
            {
                var batchProcessingTypesList = campusLogicSection.BatchProcessingTypesList;

                for (var i = 0; i < batchProcessingTypesList.Count; i++)
                {
                    var batchProcessingType = batchProcessingTypesList[i];

                    if (batchProcessingType.TypeName == ConfigConstants.AwardLetterPrintBatchType)
                    {
                        var batchProcesses = batchProcessingTypesList[i].BatchProcesses;

                        for (var j = 0; j < batchProcesses.Count; j++)
                        {
                            var batchProcess = batchProcesses[j];
                            if (batchProcess.IndexFileEnabled)
                            {
                                if (!FileDefinitionExistsForName(batchProcess.FileDefinitionName, fileDefinitions))
                                {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            return false;
        }

        /// <summary>
        /// Validate that file paths are unique
        /// </summary>
        /// <param name="configuration"></param>
        /// <returns></returns>
        public static bool ValidatePathsUnique(ConfigurationModel configuration)
        {
            var pathsToValidate = new List<string>();
            if (configuration.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.AwardLetterUploadSettings.AwardLetterUploadFilePath);
                pathsToValidate.Add(configuration.CampusLogicSection.AwardLetterUploadSettings.AwardLetterArchiveFilePath);
            }
            if (configuration.CampusLogicSection.DataFileUploadSettings.DataFileUploadEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.DataFileUploadSettings.DataFileUploadFilePath);
                pathsToValidate.Add(configuration.CampusLogicSection.DataFileUploadSettings.DataFileArchiveFilePath);
            }
            if (configuration.CampusLogicSection.ISIRUploadSettings.ISIRUploadEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.ISIRUploadSettings.ISIRUploadFilePath);
                pathsToValidate.Add(configuration.CampusLogicSection.ISIRUploadSettings.ISIRArchiveFilePath);
            }
            if (configuration.CampusLogicSection.ISIRCorrectionsSettings.CorrectionsEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.ISIRCorrectionsSettings.CorrectionsFilePath);
            }
            if (configuration.CampusLogicSection.DocumentSettings.DocumentsEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.DocumentSettings.DocumentStorageFilePath);
            }
            if (configuration.CampusLogicSection.FileStoreSettings.FileStoreEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.FileStoreSettings.FileStorePath);
            }
            if (configuration.CampusLogicSection.AwardLetterPrintSettings.AwardLetterPrintEnabled ?? false)
            {
                pathsToValidate.Add(configuration.CampusLogicSection.AwardLetterPrintSettings.AwardLetterPrintFilePath);
            }
            if (configuration.CampusLogicSection.BatchProcessingEnabled ?? false)
            {
                var batchProcessingTypes = configuration.CampusLogicSection.BatchProcessingTypesList;

                foreach (var batchProcessingType in batchProcessingTypes)
                {
                    var paths = batchProcessingType.BatchProcesses.Select(b => b.FilePath).Distinct();

                    foreach (var path in paths)
                    {
                        pathsToValidate.Add(path);
                    }
                }
            }

            if (pathsToValidate.Count > 1)
            {
                return pathsToValidate.Count == pathsToValidate.Distinct().Count();
            }
            return true;
        }

        /// <summary>
        /// Validating that there is only one 
        /// event notification for each event notification id
        /// </summary>
        /// <param name="eventNotifications"></param>
        /// <returns></returns>
        public static bool ValidateEventNotificationsUnique(IList<EventNotificationHandler> eventNotifications)
        {
            return eventNotifications.Count == eventNotifications.Select(x => x.EventNotificationId).Distinct().Count();
        }

        public static Dictionary<string, List<string>> GetApiEndpointNameLists(IList<EventNotificationHandler> eventNotifications, IList<ApiIntegrationEndpointDto> apiEndpoints)
        {
            var eventNotificationApiEndpointNames = new List<string>();
            var apiEndpointNames = new List<string>();
            var dict = new Dictionary<string, List<string>>();

            foreach (var eventNotification in eventNotifications)
            {
                if (eventNotification.HandleMethod == "ApiIntegration")
                {
                    eventNotificationApiEndpointNames.Add(eventNotification.ApiEndpointName);
                }
            }

            foreach (var apiEndpoint in apiEndpoints)
            {
                apiEndpointNames.Add(apiEndpoint.Name);
            }

            dict.Add("event", eventNotificationApiEndpointNames);
            dict.Add("endpoint", apiEndpointNames);

            return dict;
        }

        public static bool ValidateMissingApiEndpointNames(Dictionary<string, List<string>> apiEndpointNamesDictionary)
        {
            var eventNotificationApiEndpointNames = apiEndpointNamesDictionary["event"];
            var apiEndpointNames = apiEndpointNamesDictionary["endpoint"];

            if (eventNotificationApiEndpointNames.Except(apiEndpointNames).Any()) return false;

            return true;
        }

        public static Dictionary<string, List<string>> GetBatchNameLists(IList<EventNotificationHandler> eventNotifications, IList<BatchProcessingTypeDto> batchProcessingTypes)
        {
            var eventHandlerBatchNames = new List<string>();
            var batchProcessNames = new List<string>();
            var dict = new Dictionary<string, List<string>>();
                        
            foreach (var eventNotification in eventNotifications)
            {
                if (eventNotification.HandleMethod == "BatchProcessingAwardLetterPrint")
                {
                    eventHandlerBatchNames.Add(eventNotification.BatchName);
                }
            }

            foreach (var batchProcessingType in batchProcessingTypes)
            {
                foreach (var batchProcess in batchProcessingType.BatchProcesses)
                {
                    batchProcessNames.Add(batchProcess.BatchName);
                }
            }

            dict.Add("event", eventHandlerBatchNames);
            dict.Add("batch", batchProcessNames);

            return dict;
        }

        public static bool ValidateMissingBatchNames(Dictionary<string, List<string>> batchNamesDictionary)
        {
            var eventHandlerBatchNames = batchNamesDictionary["event"];
            var batchProcessNames = batchNamesDictionary["batch"];

            // Compare to make sure no batch hasn't been accounted for
            if (eventHandlerBatchNames.Except(batchProcessNames).Any()) return false;

            return true;
        }

        /// <summary>
        /// Validating that no batch names are empty
        /// and that they are all unique (to a given type).
        /// </summary>
        /// <param name="eventNotifications"></param>
        /// <param name="batchProcessingTypes"></param>
        /// <returns></returns>
        public static bool ValidateBatchNames(Dictionary<string, List<string>> batchNamesDictionary)
        {
            var eventHandlerBatchNames = batchNamesDictionary["event"];
            var batchProcessNames = batchNamesDictionary["batch"];

            // Check for a blank batch name within the event handlers
            if (eventHandlerBatchNames.All(x => string.IsNullOrEmpty(x))) return false;

            // Check for duplicate event handler batch names
            if (eventHandlerBatchNames.GroupBy(x => x).Any(g => g.Count() > 1)) return false;

            // Check for batch name longer than 25 characters
            if (eventHandlerBatchNames.All(x => x.Length > 25)) return false;

            // Check for a blank batch name within the batch processes
            if (batchProcessNames.All(x => string.IsNullOrEmpty(x))) return false;

            // Check for duplicate batch process names
            if (batchProcessNames.GroupBy(x => x).Any(g => g.Count() > 1)) return false;

            // Check for batch name longer than 25 characters
            if (batchProcessNames.All(x => x.Length > 25)) return false;

            return true;
        }

        /// <summary>
        /// Validating database connection
        /// if the database connection is required
        /// </summary>
        /// <param name="eventNotifications"></param>
        /// <param name="connectionString"></param>
        /// <returns></returns>
        public static bool ValidateConnectionStringValid(IList<EventNotificationHandler> eventNotifications, string connectionString)
        {
            string[] handlersWithoutConnectionString = { "DocumentRetrieval", "FileStore", "FileStoreAndDocumentRetrieval", "AwardLetterPrint", "BatchProcessingAwardLetterPrint", "ApiIntegration", "PowerFAIDS" };

            if (eventNotifications.All(x => handlersWithoutConnectionString.Contains(x.HandleMethod)))
            {
                return true;
            }

            var result = ClientDatabaseManager.TestConnectionString(connectionString);

            return string.IsNullOrEmpty(result);
        }

        /// <summary>
        /// Validate the environment
        /// </summary>
        /// <param name="applicationAppSettingsSection"></param>
        public static HttpResponseMessage ValidateEnvironment(Dictionary<string, string> applicationAppSettingsSection)
        {
            // if DisableAutoUpdate, ignore environment
            if (string.Equals(ConfigurationManager.AppSettings["DisableAutoUpdate"], "true", StringComparison.InvariantCultureIgnoreCase))
            {
                return new HttpResponseMessage(HttpStatusCode.OK);
            }

            //Ensure that the environment was set appropriately
            if (applicationAppSettingsSection["environment"] != EnvironmentConstants.SANDBOX
                && applicationAppSettingsSection["environment"] != EnvironmentConstants.PRODUCTION)
            {
                LogManager.FatalLog($"Environment required to save new configurations, environment: {applicationAppSettingsSection["environment"] } is invalid");
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        /// <summary>
        /// Validate API Credentials
        /// </summary>
        /// <param name="applicationAppSettingsSection"></param>
        /// <param name="awardLetterUploadEnabled"></param>
        public static async Task<HttpResponseMessage> ValidateApiCredentials(Dictionary<string, string> applicationAppSettingsSection, bool awardLetterUploadEnabled = false)
        {
            string apiURL = CredentialsManager.GetGwApiUrl(applicationAppSettingsSection["environment"]);

            //Ensure Credentials are valid
            var credentialsResponse = await CredentialsManager.GetOAuth2TokenAsync(applicationAppSettingsSection["apiUsername"], applicationAppSettingsSection["apiPassword"], apiURL, applicationAppSettingsSection["environment"]);
            if (!credentialsResponse.IsSuccessStatusCode)
            {
                LogManager.FatalLog($"API Credentials are not valid, username: {applicationAppSettingsSection["apiUsername"]}, password: {applicationAppSettingsSection["apiPassword"]}, environment: {applicationAppSettingsSection["environment"]}");
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);

        }

        public static void ValidateApplicationSettings()
        {
        }

        /// <summary>
        /// Validate SMTP Settings
        /// </summary>
        /// <param name="settings"></param>
        /// <param name="smtpSection"></param>
        /// <returns></returns>
        public static HttpResponseMessage ValidateSMTPSettings(SMTPSettings settings, SmtpSection smtpSection)
        {
            try
            {
                if (settings.NotificationsEnabled ?? false)
                {
                    NotificationService.ErrorNotification(smtpSection, settings.SendTo);
                }
            }
            catch (Exception exception)
            {
                LogManager.FatalLog(string.Format("There was an error sending a test email to {0} from {1}: {2}", settings.SendTo, smtpSection.From, exception));
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);

        }

        public static HttpResponseMessage ValidateISIRUploadSettings(string directoryPath)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                if (documentManager.ValidateDirectory(directoryPath))
                {
                    return new HttpResponseMessage(HttpStatusCode.OK);
                }
                else
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
        }


        public static HttpResponseMessage ValidateAwardLetterUploadSettings(string directoryPath)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                if (documentManager.ValidateDirectory(directoryPath))
                {
                    return new HttpResponseMessage(HttpStatusCode.OK);
                }
                else
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
        }

        public static HttpResponseMessage ValidateDataFileUploadSettings(DataFileUploadSettings settings)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                if (!documentManager.ValidateDirectory(settings.DataFileUploadFilePath))
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
                if (!documentManager.ValidateDirectory(settings.DataFileArchiveFilePath))
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
                return new HttpResponseMessage(HttpStatusCode.OK);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
        }

        public static HttpResponseMessage ValidateDocumentImportSettings(DocumentImportSettings settings)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                if (documentManager.ValidateDirectory(settings.FileDirectory) &&
                    documentManager.ValidateDirectory(settings.ArchiveDirectory))
                {
                    return new HttpResponseMessage(HttpStatusCode.OK);
                }
                else
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Validate the ISIR Corrections
        /// file path
        /// </summary>
        /// <param name="directoryPath"></param>
        /// <returns></returns>
        public static HttpResponseMessage ValidateIsirCorrectionSettings(ISIRCorrectionsSettings isirCorrectionsSettings)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                if (documentManager.ValidateDirectory(isirCorrectionsSettings.CorrectionsFilePath))
                {
                    if (isirCorrectionsSettings.TdClientEnabled.HasValue && isirCorrectionsSettings.TdClientEnabled.Value == true)
                    {
                        if (documentManager.ValidateDirectory(isirCorrectionsSettings.TdClientExecutablePath) &&
                            documentManager.ValidateDirectory(isirCorrectionsSettings.TdClientArchiveFilePath))
                        {
                            return new HttpResponseMessage(HttpStatusCode.OK);
                        }
                        else
                        {
                            return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                        }
                    }
                    return new HttpResponseMessage(HttpStatusCode.OK);
                }
                else
                {
                    return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
                }
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
        }

        public static HttpResponseMessage ValidateDocumentSettings(DocumentSettings settings)
        {
            try
            {
                if (settings.DocumentsEnabled == null)
                {
                    throw new Exception();
                }

                if (settings.IndexFileEnabled == null)
                {
                    throw new Exception();
                }
                else if (settings.IndexFileEnabled == true)
                {
                    if (string.IsNullOrEmpty(settings.DocumentStorageFilePath))
                    {
                        throw new Exception();
                    }
                    else
                    {
                        DocumentManager documentManager = new DocumentManager();
                        if (!documentManager.ValidateDirectory(settings.DocumentStorageFilePath))
                        {
                            throw new Exception();
                        }
                    }
                    if (string.IsNullOrEmpty(settings.FileDefinitionName))
                    {
                        throw new Exception();
                    }
                }
            }
            catch (Exception exception)
            {
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        /// <summary>
        /// Validates the File Store Settings
        /// </summary>
        /// <param name="settings"></param>
        /// <returns></returns>
        public static HttpResponseMessage ValidateFileStoreSettings(FileStoreSettings settings)
        {
            try
            {
                if (settings.FileStoreEnabled == null)
                {
                    throw new Exception();
                }

                if (string.IsNullOrEmpty(settings.FileStorePath))
                {
                    throw new Exception();
                }
                else
                {
                    FileStoreManager documentManager = new FileStoreManager();
                    if (!documentManager.ValidateDirectory(settings.FileStorePath))
                    {
                        throw new Exception();
                    }
                }
                
                if (string.IsNullOrEmpty(settings.FileStoreMinutes))
                {
                    throw new Exception();
                }

                if (string.IsNullOrEmpty(settings.FileDefinitionName))
                {
                    throw new Exception();
                }
            }
            catch (Exception exception)
            {
                LogManager.ErrorLog(exception);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        /// <summary>
        /// Validates the File Store Settings
        /// </summary>
        /// <param name="settings"></param>
        /// <returns></returns>
        public static HttpResponseMessage ValidateAwardLetterPrintSettings(AwardLetterPrintSettings settings)
        {
            try
            {
                if (settings.AwardLetterPrintEnabled == null)
                {
                    throw new Exception();
                }

                if (string.IsNullOrEmpty(settings.AwardLetterPrintFilePath))
                {
                    throw new Exception();
                }
                else
                {
                    FileStoreManager documentManager = new FileStoreManager();
                    if (!documentManager.ValidateDirectory(settings.AwardLetterPrintFilePath))
                    {
                        throw new Exception();
                    }
                }
            }
            catch (Exception exception)
            {
                LogManager.ErrorLog(exception);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        /// <summary>
        /// Validates Batch Processing Settings
        /// </summary>
        /// <returns></returns>
        public static HttpResponseMessage ValidateBatchProcessingSettings(ConfigurationModel configurationModel)
        {
            try
            {
                var batchProcessingTypes = configurationModel.CampusLogicSection.BatchProcessingTypesList;

                foreach (var batchProcessingType in batchProcessingTypes)
                {
                    var paths = batchProcessingType.BatchProcesses.Select(b => b.FilePath);

                    foreach (var path in paths)
                    {
                        if (string.IsNullOrEmpty(path))
                        {
                            throw new Exception();
                        }
                        else
                        {
                            FileStoreManager documentManager = new FileStoreManager();
                            if (!documentManager.ValidateDirectory(path))
                            {
                                throw new Exception();
                            }
                        }
                    }
                }
            }
            catch (Exception e)
            {
                LogManager.ErrorLog(e);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        /// <summary>
        /// Validates API Integrations.
        /// </summary>
        /// <returns></returns>
        public static HttpResponseMessage ValidateApiIntegrations(ConfigurationModel configurationModel)
        {
            try
            {
                if (configurationModel.CampusLogicSection.ApiIntegrationsEnabled == null)
                {
                    throw new Exception();
                }

                if (configurationModel.CampusLogicSection.ApiIntegrationsList.Count == 0)
                {
                    throw new Exception();
                }

                if (configurationModel.CampusLogicSection.ApiEndpointsList.Count == 0)
                {
                    throw new Exception();
                }
            }
            catch (Exception exception)
            {
                LogManager.ErrorLog(exception);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        public static HttpResponseMessage ValidateFileDefinitionSettings(ConfigurationModel configurationModel)
        {
            try
            {
                if (configurationModel.CampusLogicSection.FileDefinitionSettings.FileDefinitionsEnabled == null)
                {
                    throw new Exception();
                }

                var fileDefinitions = configurationModel.CampusLogicSection.FileDefinitionsList;

                if (fileDefinitions.Count == 0)
                {
                    throw new Exception();
                }
                else
                {
                    foreach (var fileDefinition in fileDefinitions)
                    {
                        if (string.IsNullOrEmpty(fileDefinition.Name))
                        {
                            throw new Exception();
                        }
                        if (string.IsNullOrEmpty(fileDefinition.FileNameFormat))
                        {
                            throw new Exception();
                        }
                        if (string.IsNullOrEmpty(fileDefinition.FileExtension))
                        {
                            throw new Exception();
                        }
                        if (string.IsNullOrEmpty(fileDefinition.FileFormat))
                        {
                            throw new Exception();
                        }
                        if (fileDefinition.FieldMappingCollection.Count == 0)
                        {
                            throw new Exception();
                        }

                        //loop through each field mapping
                        foreach (FieldMapSettings fieldMapping in fileDefinition.FieldMappingCollection)
                        {
                            if (fieldMapping.FieldSize == null)
                            {
                                throw new Exception();
                            }
                            if (fieldMapping.DataType == null)
                            {
                                throw new Exception();
                            }
                            if (fieldMapping.FileFieldName == null)
                            {
                                throw new Exception();
                            }
                            if (fileDefinition.FileFormat == "xml" && fieldMapping.FileFieldName.Contains(" "))
                            {
                                throw new Exception();
                            }
                            if (fileDefinition.IncludeHeaderRecord && (fileDefinition.FileFormat == "csv" || fileDefinition.FileFormat == "csvnoquotes") && fieldMapping.FileFieldName.Contains(","))
                            {
                                throw new Exception();
                            }
                        }
                    }
                }
            }
            catch (Exception e)
            {
                LogManager.ErrorLog(e);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }

        public static HttpResponseMessage ValidatePowerFaidsSettings(ConfigurationModel configurationModel)
        {
            try
            {
                if (configurationModel.CampusLogicSection.PowerFaidsEnabled == null)
                {
                    throw new Exception();
                }

                var settings = configurationModel.CampusLogicSection.PowerFaidsSettings;

                if (settings != null)
                {
                    if (string.IsNullOrEmpty(settings.FilePath))
                    {
                        throw new Exception();
                    }

                    if (!settings.IsBatch.HasValue)
                    {
                        throw new Exception();
                    }
                    else
                    {
                        if (settings.IsBatch.Value == true && string.IsNullOrEmpty(settings.BatchExecutionMinutes))
                        {
                            throw new Exception();
                        }
                    }

                    var powerFaidsList = configurationModel.CampusLogicSection.PowerFaidsList;

                    if (powerFaidsList != null && powerFaidsList.Count > 0)
                    {
                        for (int i = 0; i < powerFaidsList.Count; i++)
                        {
                            var record = powerFaidsList[i];

                            if (!string.IsNullOrEmpty(record.Event))
                            {
                                // Check for uniqueness of combination of Event Notification ID/Transaction Category
                                for (int j = 0; j < powerFaidsList.Count; j++)
                                {
                                    if (j != i && powerFaidsList[j].Event == record.Event && 
                                        // if there is no tran category, true, otherwise compare
                                        (!string.IsNullOrEmpty(record.TransactionCategory) ? powerFaidsList[j].TransactionCategory == record.TransactionCategory : true))
                                    {
                                        throw new Exception();
                                    }
                                }

                                // Ensure the event is mapped
                                if (!configurationModel.CampusLogicSection.EventNotificationsList.Any(e => e.EventNotificationId.ToString() == record.Event))
                                {
                                    throw new Exception();
                                }

                                if (!string.IsNullOrEmpty(record.Outcome))
                                {
                                    if (record.Outcome == "documents" && (string.IsNullOrEmpty(record.ShortName) || string.IsNullOrEmpty(record.RequiredFor) || string.IsNullOrEmpty(record.Status) || string.IsNullOrEmpty(record.DocumentLock)))
                                    {
                                        throw new Exception();
                                    }
                                    else if (record.Outcome == "verification" && (string.IsNullOrEmpty(record.VerificationOutcome) || string.IsNullOrEmpty(record.VerificationOutcomeLock)))
                                    {
                                        throw new Exception();
                                    }
                                    else if (record.Outcome == "both" && (string.IsNullOrEmpty(record.ShortName) || string.IsNullOrEmpty(record.RequiredFor) || string.IsNullOrEmpty(record.Status) || string.IsNullOrEmpty(record.DocumentLock) || string.IsNullOrEmpty(record.VerificationOutcome) || string.IsNullOrEmpty(record.VerificationOutcomeLock)))
                                    {
                                        throw new Exception();
                                    }
                                }
                                else
                                {
                                    throw new Exception();
                                }
                            }
                            else
                            {
                                throw new Exception();
                            }
                        }
                    }
                    else
                    {
                        throw new Exception();
                    }
                }
                else
                {
                    throw new Exception();
                }
            }
            catch (Exception e)
            {
                LogManager.ErrorLog(e);
                return new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }

            return new HttpResponseMessage(HttpStatusCode.OK);
        }
    }
}




