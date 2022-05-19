using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Filters;
using CampusLogicEvents.Web.Models;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Data.Odbc;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Configuration;
using System.Net.Http;
using System.Reflection;
using System.Threading;
using System.Web;
using System.Web.Configuration;
using System.Web.Http;

namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class SetupController : ApiController
    {
        public SetupController()
        {

        }

        /// <summary>
        /// Deletes File Store and Document settings after being transferred to File Definitions.
        /// </summary>
        /// <param name="campusLogicSection"></param>
        private void ClearOldFileDefinitions(CampusLogicSection campusLogicSection)
        {
            var fileStoreSettings = campusLogicSection.FileStoreSettings;
            if (fileStoreSettings.FileStoreEnabled ?? false)
            {
                fileStoreSettings.FileStoreNameFormat = null;
                fileStoreSettings.IncludeHeaderRecord = null;
                fileStoreSettings.FileStoreFileFormat = null;
                fileStoreSettings.FileExtension = null;
                fileStoreSettings.FileStoreMappingCollectionConfig = null;
            }

            var documentSettings = campusLogicSection.DocumentSettings;
            if (documentSettings.DocumentsEnabled ?? false)
            {
                documentSettings.FileNameFormat = null;
                documentSettings.IncludeHeaderRecord = null;
                documentSettings.IndexFileExtension = null;
                documentSettings.IndexFileFormat = null;
                documentSettings.FieldMappingCollectionConfig = null;
            }
        }

        /// <summary>
        /// Creates File Definition records for existing File Store and Document (Event Notification) settings and field mappings.
        /// Assigns a unique name to each new File Definition record
        /// and removes the original from the File Store/Document section.
        /// This is all in-memory, so nothing is finalized until the user clicks Save in the setup.
        /// </summary>
        private void ConvertToFileDefinition(ConfigurationModel response)
        {
            // Convert the File Store settings
            var fileStoreSettings = response.CampusLogicSection.FileStoreSettings;
            if (fileStoreSettings.FileStoreEnabled ?? false)
            {
                // We can't convert if a File Store doesn't have any field mappings
                if (fileStoreSettings.FileStoreMappingCollectionConfig.Count > 0)
                {
                    // Make sure we're enabling File Definitions
                    response.CampusLogicSection.FileDefinitionsEnabled = true;

                    var fileDefinitionSetting = new FileDefinitionSetting();

                    // Create a unique name
                    var fileDefinitionSettings = response.CampusLogicSection.FileDefinitionSettings.GetFileDefinitionSettings();
                    bool uniqueNameGenerated = false;
                    var index = 1;
                    while (!uniqueNameGenerated)
                    {
                        var name = "FILE_STORE_DEFINITION_" + index;

                        if (!fileDefinitionSettings.Any(f => f.Name == name))
                        {
                            fileDefinitionSetting.Name = name;
                            uniqueNameGenerated = true;
                        }

                        index++;
                    }

                    // Update the File Store setting File Definition Name
                    fileStoreSettings.FileDefinitionName = fileDefinitionSetting.Name;

                    // Assign all the properties
                    fileDefinitionSetting.FileNameFormat = fileStoreSettings.FileStoreNameFormat;
                    fileDefinitionSetting.IncludeHeaderRecord = fileStoreSettings.IncludeHeaderRecord;
                    fileDefinitionSetting.FileExtension = fileStoreSettings.FileExtension;
                    fileDefinitionSetting.FileFormat = fileStoreSettings.FileStoreFileFormat;

                    // Get all the field mappings
                    foreach (FieldMapSettings fieldMapSetting in fileStoreSettings.FileStoreMappingCollectionConfig)
                    {
                        fileDefinitionSetting.FieldMappingCollectionConfig.Add(fieldMapSetting);
                    }

                    // Add the File Definition to memory
                    response.CampusLogicSection.FileDefinitionsList.Add(new FileDefinitionDto(fileDefinitionSetting));
                }
            }

            // Convert the Document settings
            var documentSettings = response.CampusLogicSection.DocumentSettings;
            if (documentSettings.DocumentsEnabled ?? false)
            {
                // We can't convert if a Document doesn't have any field mappings
                if (documentSettings.FieldMappingCollectionConfig.Count > 0)
                {
                    // Make sure we're enabling File Definitions
                    response.CampusLogicSection.FileDefinitionsEnabled = true;

                    var fileDefinitionSetting = new FileDefinitionSetting();

                    // Create a unique name
                    var fileDefinitionSettings = response.CampusLogicSection.FileDefinitionSettings.GetFileDefinitionSettings();
                    bool uniqueNameGenerated = false;
                    var index = 1;
                    while (!uniqueNameGenerated)
                    {
                        var name = "DOCUMENT_DEFINITION_" + index;

                        if (!fileDefinitionSettings.Any(f => f.Name == name))
                        {
                            fileDefinitionSetting.Name = name;
                            uniqueNameGenerated = true;
                        }

                        index++;
                    }

                    // Update the Document setting File Definition Name
                    documentSettings.FileDefinitionName = fileDefinitionSetting.Name;

                    // Assign all the properties
                    fileDefinitionSetting.FileNameFormat = documentSettings.FileNameFormat;
                    fileDefinitionSetting.IncludeHeaderRecord = documentSettings.IncludeHeaderRecord;
                    fileDefinitionSetting.FileExtension = documentSettings.IndexFileExtension;
                    fileDefinitionSetting.FileFormat = documentSettings.IndexFileFormat;

                    // Get all the field mappings
                    foreach (FieldMapSettings fieldMapSetting in documentSettings.FieldMappingCollectionConfig)
                    {
                        fileDefinitionSetting.FieldMappingCollectionConfig.Add(fieldMapSetting);
                    }

                    // Add the File Definition to memory
                    response.CampusLogicSection.FileDefinitionsList.Add(new FileDefinitionDto(fileDefinitionSetting));
                }
            }
        }

        /// <summary>
        /// Get current configurations 
        /// from web.config
        /// or new configurations model
        /// if this is an initial setup
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public HttpResponseMessage Configurations()
        {
            try
            {
                var response = new ConfigurationModel();
                response.CampusLogicSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);

                //appSettings, for some reason it will not serialize appSettingSection, so we set
                // it to a simple dictionary to pass back
                var appSettings = new Dictionary<string, string>();
                for (int i = 0; i < ConfigurationManager.AppSettings.Count; i++)
                {
                    //Remove the placeholders if this is an initial setup
                    appSettings.Add(ConfigurationManager.AppSettings.GetKey(i), ConfigurationManager.AppSettings[i]);
                }

                //Environment was added with the most recent version
                //If it does not exist, add it and version, and 
                //adjust all naming conventions that have changed
                if (!appSettings.ContainsKey("Environment"))
                {
                    Assembly clConnectAssembly = Assembly.GetExecutingAssembly();
                    AssemblyName clConnect = clConnectAssembly.GetName();
                    appSettings.Add("Environment", "initial");
                    appSettings.Add("ClConnectVersion", clConnect.Version.ToString());
                    if (appSettings.ContainsKey("FileStoragePath"))
                    {
                        response.CampusLogicSection.DocumentSettings.DocumentStorageFilePath = appSettings["FileStoragePath"];
                        appSettings.Remove("FileStoragePath");
                    }
                }

                //PMWebApiUrl is a newer setting that's needed for use with some newer datafile integrations
                if (!appSettings.ContainsKey("PmWebApiUrl"))
                {
                    appSettings.Add("PmWebApiUrl", "");
                }

                //SUWebApiUrl is a newer setting that's needed for use with some newer datafile integrations
                if (!appSettings.ContainsKey("SuWebApiUrl"))
                {
                    appSettings.Add("SuWebApiUrl", "");
                }

                // Newer setting
                if (!appSettings.ContainsKey("SaWebApiUrl"))
                {
                    appSettings.Add("SaWebApiUrl", "");
                }

                // Newer setting
                if (!appSettings.ContainsKey("SpWebApiUrl"))
                {
                    appSettings.Add("SpWebApiUrl", "");
                }

                if (response.CampusLogicSection.EventNotifications.Count > 0)
                {
                    response.CampusLogicSection.EventNotificationsEnabled = true;
                }

                response.CampusLogicSection.DocumentSettings.DocumentsEnabled = response.CampusLogicSection.DocumentSettings.DocumentsEnabled ?? response.CampusLogicSection.DocumentSettings.IndexFileEnabled;
                response.AppSettingsSection = appSettings;
                //temp workaround for deserialization issue
                response.CampusLogicSection.EventNotificationsEnabled = (response.CampusLogicSection.EventNotifications.EventNotificationsEnabled ?? false)
                                                                            || (response.CampusLogicSection.StoredProcedures.StoredProceduresEnabled ?? false)
                                                                            || (response.CampusLogicSection.DocumentSettings.DocumentsEnabled ?? false)
                                                                            || (response.CampusLogicSection.FileStoreSettings.FileStoreEnabled ?? false)
                                                                            || (response.CampusLogicSection.AwardLetterPrintSettings.AwardLetterPrintEnabled ?? false)
                                                                            || (response.CampusLogicSection.BatchProcessingTypes.BatchProcessingEnabled ?? false)
                                                                            || (response.CampusLogicSection.ApiIntegrations.ApiIntegrationsEnabled ?? false)
                                                                            || (response.CampusLogicSection.FileDefinitionSettings.FileDefinitionsEnabled ?? false)
                                                                            || (response.CampusLogicSection.PowerFaidsSettings.PowerFaidsEnabled ?? false);

                if (response.CampusLogicSection.StoredProcedures != null)
                {
                    response.CampusLogicSection.StoredProceduresEnabled = response.CampusLogicSection.StoredProcedures.StoredProceduresEnabled;
                    response.SmtpSection = (SmtpSection)ConfigurationManager.GetSection("system.net/mailSettings/smtp");
                    response.CampusLogicSection.StoredProcedureList =
                        response.CampusLogicSection.StoredProcedures.GetStoredProcedures()
                            .Select(sp => new StoredProcedureDto(sp.Name, sp.GetParameters().ToList()))
                            .ToList();
                }

                if (response.CampusLogicSection.BatchProcessingTypes != null)
                {
                    response.CampusLogicSection.BatchProcessingEnabled = response.CampusLogicSection.BatchProcessingTypes.BatchProcessingEnabled;
                    response.CampusLogicSection.BatchProcessingTypesList =
                        response.CampusLogicSection.BatchProcessingTypes.GetBatchProcessingTypes()
                            .Select(b => new BatchProcessingTypeDto(b.TypeName, b.GetBatchProcesses().ToList()))
                            .ToList();
                }

                if (response.CampusLogicSection.ApiIntegrations != null)
                {
                    response.CampusLogicSection.ApiIntegrationsEnabled = response.CampusLogicSection.ApiIntegrations.ApiIntegrationsEnabled;
                    response.CampusLogicSection.ApiIntegrationsList = response.CampusLogicSection.ApiIntegrations.GetApiIntegrations().Select(a => new ApiIntegrationDto(a)).ToList();
                    response.CampusLogicSection.ApiEndpointsList = response.CampusLogicSection.ApiEndpoints.GetEndpoints().Select(e => new ApiIntegrationEndpointDto(e)).ToList();
                }

                if (response.CampusLogicSection.FileDefinitionSettings != null)
                {
                    response.CampusLogicSection.FileDefinitionsEnabled = response.CampusLogicSection.FileDefinitionSettings.FileDefinitionsEnabled;
                    response.CampusLogicSection.FileDefinitionsList = response.CampusLogicSection.FileDefinitionSettings.GetFileDefinitionSettings().Select(f => new FileDefinitionDto(f)).ToList();
                }

                ConvertToFileDefinition(response);

                if (response.CampusLogicSection.PowerFaidsSettings != null)
                {
                    response.CampusLogicSection.PowerFaidsEnabled = response.CampusLogicSection.PowerFaidsSettings.PowerFaidsEnabled;
                    response.CampusLogicSection.PowerFaidsList = new List<PowerFaidsDto>();
                    foreach (var powerFaidSetting in response.CampusLogicSection.PowerFaidsSettings.PowerFaidsSettingCollectionConfig.GetPowerFaidsSettingList())
                    {
                        response.CampusLogicSection.PowerFaidsList.Add(new PowerFaidsDto(powerFaidSetting));
                    }
                }

                if (response.CampusLogicSection.DocumentSettings.ImportSettings != null && response.CampusLogicSection.DocumentSettings.ImportSettings.Enabled)
                {
                    response.CampusLogicSection.DocumentImportSettings.Enabled = response.CampusLogicSection.DocumentSettings.ImportSettings.Enabled;
                    response.CampusLogicSection.DocumentImportSettings.FileExtension = response.CampusLogicSection.DocumentSettings.ImportSettings.FileExtension;
                    response.CampusLogicSection.DocumentImportSettings.FileDirectory = response.CampusLogicSection.DocumentSettings.ImportSettings.FileDirectory;
                    response.CampusLogicSection.DocumentImportSettings.ArchiveDirectory = response.CampusLogicSection.DocumentSettings.ImportSettings.ArchiveDirectory;
                    response.CampusLogicSection.DocumentImportSettings.Frequency = response.CampusLogicSection.DocumentSettings.ImportSettings.Frequency;
                    response.CampusLogicSection.DocumentImportSettings.HasHeaderRow = response.CampusLogicSection.DocumentSettings.ImportSettings.HasHeaderRow;
                    response.CampusLogicSection.DocumentImportSettings.UseSSN = response.CampusLogicSection.DocumentSettings.ImportSettings.UseSSN;
                }

                response.CampusLogicSection.DocumentSettings.ImportSettings = null;

                return Request.CreateResponse(HttpStatusCode.OK, response);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("SetupController GetCurrentConfigurations Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        [HttpPost]
        public HttpResponseMessage ArchiveWebConfig()
        {
            try
            {
                var sourcePath = HttpContext.Current.Server.MapPath("~/Web.config");
                var targetPath = HttpContext.Current.Server.MapPath("~/WebArchive/");
                var fileName = $"webConfigCopy{DateTime.UtcNow.ToFileTimeUtc()}.config";
                targetPath = Path.Combine(targetPath, fileName);
                File.Copy(sourcePath, targetPath);
                return Request.CreateResponse(HttpStatusCode.OK);
            }
            catch (Exception exception)
            {
                LogManager.ErrorLogFormat("SetupController ArchiveWebConfig Error: {0}", exception);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }

        }

        /// <summary>
        /// Save new configurations
        /// </summary>
        /// <param name="configurationModel"></param>
        [HttpPost]
        public HttpResponseMessage Configurations(ConfigurationModel configurationModel)
        {
            try
            {
                Configuration config = WebConfigurationManager.OpenWebConfiguration(HttpContext.Current.Request.ApplicationPath);
                CampusLogicSection campusLogicSection = (CampusLogicSection)config.GetSection("campusLogicConfig");
                SmtpSection smtpSection = (SmtpSection)config.GetSection("system.net/mailSettings/smtp");
                AppSettingsSection appSettings = config.AppSettings;

                //Workarounds until we can figure out why the properties won't deserialize as is
                campusLogicSection.EventNotifications = configurationModel.CampusLogicSection.EventNotifications;
                campusLogicSection.EventNotifications.EventNotificationsEnabled =
                    configurationModel.CampusLogicSection.EventNotificationsEnabled;
                foreach (EventNotificationHandler eventNotificationHandler in configurationModel.CampusLogicSection.EventNotificationsList)
                {
                    campusLogicSection.EventNotifications.Add(eventNotificationHandler);
                }

                campusLogicSection.FileStoreSettings = configurationModel.CampusLogicSection.FileStoreSettings;
                foreach (FieldMapSettings fieldMapSetting in configurationModel.CampusLogicSection.FileStoreSettings.FileStoreMappingCollection)
                {
                    campusLogicSection.FileStoreSettings.FileStoreMappingCollectionConfig.Add(fieldMapSetting);
                }

                campusLogicSection.DocumentSettings = configurationModel.CampusLogicSection.DocumentSettings;
                foreach (FieldMapSettings fieldMapSetting in configurationModel.CampusLogicSection.DocumentSettings.FieldMappingCollection)
                {
                    campusLogicSection.DocumentSettings.FieldMappingCollectionConfig.Add(fieldMapSetting);
                }

                campusLogicSection.StoredProcedures = configurationModel.CampusLogicSection.StoredProcedures;
                campusLogicSection.StoredProcedures.StoredProceduresEnabled =
                    configurationModel.CampusLogicSection.StoredProceduresEnabled;

                foreach (StoredProcedureDto storedProcedure in configurationModel.CampusLogicSection.StoredProcedureList)
                {
                    StoredProcedureElement storedProcedureElement = new StoredProcedureElement();
                    storedProcedureElement.Name = storedProcedure.Name;

                    foreach (ParameterDto parameter in storedProcedure.ParameterList)
                    {
                        ParameterElement parameterElement = new ParameterElement();
                        parameterElement.Name = parameter.Name;
                        parameterElement.DataType = parameter.DataType;
                        parameterElement.Length = parameter.Length;
                        parameterElement.Source = parameter.Source;

                        storedProcedureElement.Add(parameterElement);
                    }

                    campusLogicSection.StoredProcedures.Add(storedProcedureElement);
                }

                campusLogicSection.BatchProcessingTypes = configurationModel.CampusLogicSection.BatchProcessingTypes;
                campusLogicSection.BatchProcessingTypes.BatchProcessingEnabled = configurationModel.CampusLogicSection.BatchProcessingEnabled;
                foreach (BatchProcessingTypeDto batchProcessingType in configurationModel.CampusLogicSection.BatchProcessingTypesList)
                {
                    BatchProcessingTypeElement batchProcessingTypeElement = new BatchProcessingTypeElement();
                    batchProcessingTypeElement.TypeName = batchProcessingType.TypeName;

                    foreach (BatchProcessDto batchProcess in batchProcessingType.BatchProcesses)
                    {
                        var batchProcessElement = new BatchProcessElement();
                        batchProcessElement.BatchName = batchProcess.BatchName;

                        if (batchProcessingTypeElement.TypeName == ConfigConstants.AwardLetterPrintBatchType)
                        {
                            batchProcessElement.MaxBatchSize = batchProcess.MaxBatchSize;
                            batchProcessElement.FilePath = batchProcess.FilePath;
                            batchProcessElement.FileNameFormat = batchProcess.FileNameFormat;
                            batchProcessElement.BatchExecutionMinutes = batchProcess.BatchExecutionMinutes;
                            batchProcessElement.IndexFileEnabled = batchProcess.IndexFileEnabled;
                            batchProcessElement.FileDefinitionName = batchProcess.FileDefinitionName;
                        }

                        batchProcessingTypeElement.Add(batchProcessElement);
                    }

                    campusLogicSection.BatchProcessingTypes.Add(batchProcessingTypeElement);
                }

                campusLogicSection.FileDefinitionSettings = configurationModel.CampusLogicSection.FileDefinitionSettings;
                campusLogicSection.FileDefinitionSettings.FileDefinitionsEnabled = configurationModel.CampusLogicSection.FileDefinitionsEnabled;
                foreach (var listSetting in configurationModel.CampusLogicSection.FileDefinitionsList)
                {
                    FileDefinitionSetting fileDefinitionSetting = new FileDefinitionSetting();
                    fileDefinitionSetting.Name = listSetting.Name;
                    fileDefinitionSetting.FileNameFormat = listSetting.FileNameFormat;
                    fileDefinitionSetting.IncludeHeaderRecord = listSetting.IncludeHeaderRecord;
                    fileDefinitionSetting.FileExtension = listSetting.FileExtension;
                    fileDefinitionSetting.FileFormat = listSetting.FileFormat;

                    foreach (var fieldMapping in listSetting.FieldMappingCollection)
                    {
                        fileDefinitionSetting.FieldMappingCollectionConfig.Add(fieldMapping);
                    }

                    campusLogicSection.FileDefinitionSettings.Add(fileDefinitionSetting);
                }

                campusLogicSection.ApiIntegrations = configurationModel.CampusLogicSection.ApiIntegrations;
                campusLogicSection.ApiIntegrations.ApiIntegrationsEnabled = configurationModel.CampusLogicSection.ApiIntegrationsEnabled;
                foreach (ApiIntegrationDto apiIntegration in configurationModel.CampusLogicSection.ApiIntegrationsList)
                {
                    ApiIntegrationElement apiIntegrationElement = new ApiIntegrationElement();
                    apiIntegrationElement.ApiId = apiIntegration.ApiId;
                    apiIntegrationElement.ApiName = apiIntegration.ApiName;
                    apiIntegrationElement.Authentication = apiIntegration.Authentication;
                    apiIntegrationElement.TokenService = apiIntegration.TokenService;
                    apiIntegrationElement.Root = apiIntegration.Root;
                    apiIntegrationElement.Username = apiIntegration.Username;
                    apiIntegrationElement.Password = apiIntegration.Password;

                    campusLogicSection.ApiIntegrations.Add(apiIntegrationElement);
                }

                campusLogicSection.ApiEndpoints = configurationModel.CampusLogicSection.ApiEndpoints;
                foreach (ApiIntegrationEndpointDto apiEndpoint in configurationModel.CampusLogicSection.ApiEndpointsList)
                {
                    ApiIntegrationEndpointElement endpointElement = new ApiIntegrationEndpointElement();
                    endpointElement.Name = apiEndpoint.Name;
                    endpointElement.Endpoint = apiEndpoint.Endpoint;
                    endpointElement.ApiId = apiEndpoint.ApiId;
                    endpointElement.Method = apiEndpoint.Method;
                    endpointElement.MimeType = apiEndpoint.MimeType;
                    endpointElement.ParameterMappings = JArray.Parse(apiEndpoint.ParameterMappings).ToString();

                    campusLogicSection.ApiEndpoints.Add(endpointElement);
                }

                campusLogicSection.PowerFaidsSettings = configurationModel.CampusLogicSection.PowerFaidsSettings;
                campusLogicSection.PowerFaidsSettings.PowerFaidsEnabled = configurationModel.CampusLogicSection.PowerFaidsEnabled;
                foreach (var record in configurationModel.CampusLogicSection.PowerFaidsList)
                {
                    PowerFaidsSetting powerFaidsSetting = new PowerFaidsSetting();
                    powerFaidsSetting.Event = record.Event;
                    powerFaidsSetting.Outcome = record.Outcome;
                    powerFaidsSetting.ShortName = record.ShortName;
                    powerFaidsSetting.RequiredFor = record.RequiredFor;
                    powerFaidsSetting.Status = record.Status;
                    powerFaidsSetting.DocumentLock = record.DocumentLock;
                    powerFaidsSetting.VerificationOutcome = record.VerificationOutcome;
                    powerFaidsSetting.VerificationOutcomeLock = record.VerificationOutcomeLock;
                    powerFaidsSetting.TransactionCategory = record.TransactionCategory;

                    campusLogicSection.PowerFaidsSettings.PowerFaidsSettingCollectionConfig.Add(powerFaidsSetting);
                }

                campusLogicSection.BulkActionSettings = configurationModel.CampusLogicSection.BulkActionSettings;
                campusLogicSection.ISIRUploadSettings = configurationModel.CampusLogicSection.ISIRUploadSettings;
                campusLogicSection.ISIRCorrectionsSettings = configurationModel.CampusLogicSection.ISIRCorrectionsSettings;
                campusLogicSection.AwardLetterUploadSettings = configurationModel.CampusLogicSection.AwardLetterUploadSettings;
                campusLogicSection.DataFileUploadSettings = configurationModel.CampusLogicSection.DataFileUploadSettings;
                campusLogicSection.FileMappingUploadSettings = configurationModel.CampusLogicSection.FileMappingUploadSettings;
                campusLogicSection.AwardLetterPrintSettings = configurationModel.CampusLogicSection.AwardLetterPrintSettings;
                campusLogicSection.SMTPSettings = configurationModel.CampusLogicSection.SMTPSettings;
                campusLogicSection.ClientDatabaseConnection = configurationModel.CampusLogicSection.ClientDatabaseConnection;
                campusLogicSection.DocumentImportSettings = configurationModel.CampusLogicSection.DocumentImportSettings;
                smtpSection.DeliveryMethod = configurationModel.SmtpSection.DeliveryMethod;
                smtpSection.DeliveryFormat = configurationModel.SmtpSection.DeliveryFormat;
                smtpSection.From = configurationModel.SmtpSection.From;
                smtpSection.Network.ClientDomain = configurationModel.SmtpSection.Network.ClientDomain;
                smtpSection.Network.DefaultCredentials = configurationModel.SmtpSection.Network.DefaultCredentials;
                smtpSection.Network.EnableSsl = configurationModel.SmtpSection.Network.EnableSsl;
                smtpSection.Network.Host = configurationModel.SmtpSection.Network.Host;
                smtpSection.Network.Password = configurationModel.SmtpSection.Network.Password;
                smtpSection.Network.Port = configurationModel.SmtpSection.Network.Port;
                smtpSection.Network.TargetName = configurationModel.SmtpSection.Network.TargetName;
                smtpSection.Network.UserName = configurationModel.SmtpSection.Network.UserName;
                smtpSection.SpecifiedPickupDirectory.PickupDirectoryLocation = configurationModel.SmtpSection.SpecifiedPickupDirectory.PickupDirectoryLocation;
                appSettings.Settings.Clear();

                foreach (var appSetting in configurationModel.AppSettingsSection)
                {
                    appSettings.Settings.Add(FirstCharToUpper(appSetting.Key), appSetting.Value);
                }

                Assembly clConnectAssembly = Assembly.GetExecutingAssembly();
                AssemblyName clConnect = clConnectAssembly.GetName();

                appSettings.Settings["ClConnectVersion"].Value = clConnect.Version.ToString();
                appSettings.Settings["Webpages:Version"].Value = "2.0.0.0";
                appSettings.Settings["Webpages:Enabled"].Value = "false";
                appSettings.Settings["PreserveLoginUrl"].Value = "true";
                appSettings.Settings["ClientValidationEnabled"].Value = "true";
                appSettings.Settings["UnobtrusiveJavaScriptEnabled"].Value = "true";

                // Check if disabled
                string value = ConfigurationManager.AppSettings["DisableAutoUpdate"] ?? "false";
                bool.TryParse(value, out bool isDisabled);
                if (isDisabled)
                {
                    // Skip it
                }
                else if (appSettings.Settings["Environment"].Value == EnvironmentConstants.SANDBOX)
                {
                    appSettings.Settings["StsUrl"].Value = ApiUrlConstants.STS_URL_SANDBOX;
                    appSettings.Settings["SvWebApiUrl"].Value = ApiUrlConstants.SV_API_URL_SANDBOX;
                    appSettings.Settings["AwardLetterWebApiUrl"].Value = ApiUrlConstants.AL_API_URL_SANDBOX;
                    appSettings.Settings["PmWebApiUrl"].Value = ApiUrlConstants.PM_API_URL_SANDBOX;
                    appSettings.Settings["SuWebApiUrl"].Value = ApiUrlConstants.SU_API_URL_SANDBOX;
                    appSettings.Settings["SaWebApiUrl"].Value = ApiUrlConstants.SA_API_URL_SANDBOX;
                    appSettings.Settings["SpWebApiUrl"].Value = ApiUrlConstants.SP_API_URL_SANDBOX;
                }
                else
                {
                    appSettings.Settings["StsUrl"].Value = ApiUrlConstants.STS_URL_PRODUCTION;
                    appSettings.Settings["SvWebApiUrl"].Value = ApiUrlConstants.SV_API_URL_PRODUCTION;
                    appSettings.Settings["AwardLetterWebApiUrl"].Value = ApiUrlConstants.AL_API_URL_PRODUCTION;
                    appSettings.Settings["PmWebApiUrl"].Value = ApiUrlConstants.PM_API_URL_PRODUCTION;
                    appSettings.Settings["SuWebApiUrl"].Value = ApiUrlConstants.SU_API_URL_PRODUCTION;
                    appSettings.Settings["SaWebApiUrl"].Value = ApiUrlConstants.SA_API_URL_PRODUCTION;
                    appSettings.Settings["SpWebApiUrl"].Value = ApiUrlConstants.SP_API_URL_PRODUCTION;
                }

                ClearOldFileDefinitions(campusLogicSection);

                config.Save();
                return Request.CreateResponse(HttpStatusCode.OK);

            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("SetupController SaveConfigurations Error: {0}", ex);
            }

            return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
        }

        /// <summary>
        /// Get initial configuration validation model
        /// with all section valid
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public HttpResponseMessage GetInitialConfigurationValidationModel()
        {
            try
            {
                var newConfigurationValidationModel = new ConfigurationValidationModel
                {
                    EnvironmentValid = true,
                    ApiCredentialsValid = true,
                    ApplicationSettingsValid = true,
                    SMTPValid = true,
                    ISIRUploadValid = true,
                    BulkActionSettingsValid = true,
                    DataFileUploadValid = true,
                    AwardLetterUploadValid = true,
                    ISIRCorrectionsValid = true,
                    EventNotificationsValid = true,
                    ConnectionStringValid = true,
                    DocumentSettingsValid = true,
                    FileStoreSettingsValid = true,
                    AwardLetterPrintSettingsValid = true,
                    DocumentImportsValid = true,
                    StoredProcedureValid = true,
                    DuplicatePath = false,
                    DuplicateEvent = false,
                    InvalidBatchName = false,
                    FileMappingUploadValid = true,
                    BatchProcessingSettingsValid = true,
                    ApiIntegrationsValid = true,
                    FileDefinitionSettingsValid = true,
                    PowerFaidsSettingsValid = true
                };
                return Request.CreateResponse(HttpStatusCode.OK, newConfigurationValidationModel);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("SetupController GetInitialConfigurationValidationModel Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Get the version of CL Connect
        /// to display on the home page :)
        /// </summary>
        /// <returns></returns>
        [HttpGet]
        public HttpResponseMessage Version()
        {
            try
            {

                Assembly web = Assembly.GetExecutingAssembly();
                AssemblyName webName = web.GetName();

                var myVersion = webName.Version;

                return Request.CreateResponse(HttpStatusCode.OK, myVersion);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("SetupController Version Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Get all of the 
        /// enabled configurations validation
        /// status from the server
        /// </summary>
        /// <param name="configurationModel"></param>
        /// <returns></returns>
        [HttpPost]
        public HttpResponseMessage ValidateConfigurations(ConfigurationModel configurationModel)
        {
            try
            {
                var response = ValidationService.ValidateAll(configurationModel);
                if (response.DuplicateEvent || response.DuplicatePath
                    || !response.EnvironmentValid
                    || !response.ApiCredentialsValid
                    || (response.SMTPValid != null && (bool)!response.SMTPValid)
                    || (response.ISIRUploadValid != null && (bool)!response.ISIRUploadValid)
                    || (response.AwardLetterUploadValid != null && (bool)!response.AwardLetterUploadValid)
                    || (response.DataFileUploadValid != null && (bool)!response.DataFileUploadValid)
                    || (response.ISIRCorrectionsValid != null && (bool)!response.ISIRCorrectionsValid)
                    || (response.EventNotificationsValid != null && (bool)!response.EventNotificationsValid)
                    || (response.ConnectionStringValid != null && (bool)!response.ConnectionStringValid)
                    || (response.DocumentSettingsValid != null && (bool)!response.DocumentSettingsValid)
                    || (response.FileStoreSettingsValid != null && (bool)!response.FileStoreSettingsValid)
                    || (response.AwardLetterPrintSettingsValid != null && (bool)!response.AwardLetterPrintSettingsValid)
                    || (response.BatchProcessingSettingsValid != null && (bool)!response.BatchProcessingSettingsValid)
                    || (response.ApiIntegrationsValid != null && (bool)!response.ApiIntegrationsValid)
                    || (response.StoredProcedureValid != null && (bool)!response.StoredProcedureValid)
                    || (response.FileDefinitionSettingsValid != null && (bool)!response.FileDefinitionSettingsValid)
                    || (response.PowerFaidsSettingsValid != null && (bool)!response.PowerFaidsSettingsValid)
                    || !response.ApiCredentialsValid
                    || response.InvalidBatchName
                    || response.MissingBatchName
                    || response.MissingApiEndpointName
                    || response.ImproperFileDefinitions)
                {
                    return Request.CreateResponse(HttpStatusCode.ExpectationFailed, response);
                }
                return Request.CreateResponse(HttpStatusCode.OK, response);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("SetupController GetCurrentConfigurations Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Undo camel casing that is 
        /// caused when appSettings is sent 
        /// to the client side
        /// </summary>
        /// <param name="input"></param>
        /// <returns></returns>
        private static string FirstCharToUpper(string input)
        {
            if (String.IsNullOrEmpty(input))
                throw new ArgumentException("ARGH!");
            return input.First().ToString().ToUpper() + input.Substring(1);
        }
    }
}