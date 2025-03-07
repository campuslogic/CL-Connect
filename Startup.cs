using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using CampusLogicEvents.Web.Models;
using Hangfire;
using Hangfire.Logging;
using Hangfire.Storage;
using Microsoft.Owin;
using Owin;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Net.Configuration;
using System.Net.Mail;
using System.Text.RegularExpressions;
using System.Web.Configuration;
using System.Web.Hosting;

[assembly: OwinStartup(typeof(CampusLogicEvents.Web.Startup))]

namespace CampusLogicEvents.Web
{
    /*IMPORTANT: Hangfire uses NCronTab syntax. Be careful when using online cron expression builders */
    public class Startup
    {
        private static readonly CampusLogicSection campusLogicSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);
        private static readonly NotificationManager notificationManager = new NotificationManager();
        private const string ISIR_INCORRECT_FORMAT_ERROR = "ISIR corrections DaysToRun is in an incorrect format";
        private List<string> _acceptedDaysToRun = new List<string> { "SUN", "MON", "TUE", "WED", "THUR", "FRI", "SAT" };

        public void Configuration(IAppBuilder app)
        {
            // Automatic update
            PerformUpdate();

            var workerCount = ConfigurationManager.AppSettings["BackgroundWorkerCount"];
            var workerRetryAttempts = ConfigurationManager.AppSettings["BackgroundWorkerRetryAttempts"];

            //Hangfire configurations
            GlobalConfiguration.Configuration
                .UseSqlServerStorage("CampusLogicConnection");
            GlobalJobFilters.Filters.Add(new AutomaticRetryAttribute { Attempts = string.IsNullOrWhiteSpace(workerRetryAttempts) ? 10 : Convert.ToInt32(workerRetryAttempts) });

            LogProvider.SetCurrentLogProvider(new CustomLogProvider());

            var options = new BackgroundJobServerOptions { WorkerCount = string.IsNullOrWhiteSpace(workerCount) ? Environment.ProcessorCount : Convert.ToInt32(workerCount) };

            // Map Dashboard to the `http://<your-app>/hangfire` URL.
            app.UseHangfireDashboard();
            app.UseHangfireServer(options);

            // Setup/Update scheduled job
            RecurringJob.AddOrUpdate(() => DataService.DataCleanup(), Cron.Daily);

            SchemaUpdates();

            ValidateSMTPSettings();
            AutomatedISIRUpload();
            AutomatedBulkActionJob();
            AutomatedAwardLetterUpload();
            AutomatedFileMappingUpload();
            AutomatedDataFileUpload();
            AutomatedSecureFileUpload();
            AutomatedISIRCorrectionBatching();
            AutomatedDocumentImportWorker();
            AutomatedFileStoreJob();
            AutomatedBatchProcessingJob();
            AutomatedPowerFaidsJob();
        }

        private void SchemaUpdates()
        {
            VerifyEventNotificationTableExists();
            VerifyEventPropertyTableExists();
            VerifyEventPropertyOldColumnsExist();
            VerifyEventNotificationDefinitionTableExists();
        }

        /// <summary>
        /// Performs any updates that should happen automatically.  Make sure changes are only
        /// performed if required.
        /// </summary>
        private void PerformUpdate()
        {
            // Don't let problems stop us from running
            try
            {
                // Check if disabled
                var isDisabled = false;
                var value = ConfigurationManager.AppSettings["DisableAutoUpdate"] ?? "false";
                bool.TryParse(value, out isDisabled);
                if(isDisabled)
                {
                    // Skip it
                    return;
                }

                // Check the environment and the STS and update the GwWebApiUrl if a value is not present
                var environment = ConfigurationManager.AppSettings["Environment"] ?? "initial";
                var hasChanges = string.IsNullOrWhiteSpace(ConfigurationManager.AppSettings["GwWebApiUrl"]);
                Configuration config = null;
                if (hasChanges)
                {
                    config = WebConfigurationManager.OpenWebConfiguration(HostingEnvironment.ApplicationVirtualPath);
                    if (ConfigurationManager.AppSettings["GwWebApiUrl"] == null) //If the property doesnt exist add it
                    {
                        if (environment == EnvironmentConstants.PRODUCTION)
                        {
                            config.AppSettings.Settings.Add("GwWebApiUrl", ApiUrlConstants.GW_URL_PROD);
                        }
                        else
                        {
                            config.AppSettings.Settings.Add("GwWebApiUrl", ApiUrlConstants.GW_URL_SANDBOX);
                        }
                    }
                    else if(ConfigurationManager.AppSettings["GwWebApiUrl"].Trim() == "") //If it does exist but is empty update the value
                    {
                        if (environment == EnvironmentConstants.PRODUCTION)
                        {
                            config.AppSettings.Settings["GwWebApiUrl"].Value = ApiUrlConstants.GW_URL_PROD;
                        }
                        else
                        {
                            config.AppSettings.Settings["GwWebApiUrl"].Value = ApiUrlConstants.GW_URL_SANDBOX;
                        }
                    }                
                }

                if (!hasChanges && (string.IsNullOrEmpty(environment) || string.Equals("initial", environment, StringComparison.InvariantCultureIgnoreCase)))
                {
                    // Not setup anyway
                    return;
                }

                // Save if needed
                if(hasChanges)
                {
                    // Yay, fun - archive and update
                    var sourcePath = HostingEnvironment.MapPath("~/Web.config");
                    var targetPath = HostingEnvironment.MapPath("~/WebArchive/");
                    var fileName = $"webConfigCopy{DateTime.UtcNow.ToFileTimeUtc()}.config";
                    targetPath = Path.Combine(targetPath, fileName);
                    File.Copy(sourcePath, targetPath);
                    config.Save();
                }
            }
            catch (Exception exc)
            {
                LogManager.ErrorLog($"Unhandled exception performing automatic update, please update manually: {exc}.");
            }
        }

        /// <summary>
        /// Job that runs when File Store is enabled
        /// </summary>
        private void AutomatedFileStoreJob()
        {

            bool? filestoreEnabled = campusLogicSection.FileStoreSettings.FileStoreEnabled;

            //Have to explicitly check for true. This value could be null if setup preferences have never been saved.
            if (filestoreEnabled == true)
            {
                if (string.IsNullOrWhiteSpace(campusLogicSection.FileStoreSettings.FileStorePath))
                {
                    NotificationService.ErrorNotification("Automated File Store Job", $"The following path is either unavailable or does not have the appropriate permissions: {campusLogicSection.FileStoreSettings.FileStorePath}");
                }
                else
                {
                    string minutes = campusLogicSection.FileStoreSettings.FileStoreMinutes;

                    RecurringJob.AddOrUpdate(() => FileStoreService.ProcessFileStore(), GetCronExpressionByMinutes(minutes));
                }
            }
            else
            {
                RecurringJob.RemoveIfExists("FileStoreService.ProcessFileStore");
            }
        }

        /// <summary>
        /// Validating all of the SMTP Settings
        /// </summary>
        private void ValidateSMTPSettings()
        {
            var smtpSection = (SmtpSection)ConfigurationManager.GetSection("system.net/mailSettings/smtp");
            if (campusLogicSection.SMTPSettings == null)
            {
                LogManager.ErrorLog("SMTP settings are missing");
                return;
            }
            if (campusLogicSection.SMTPSettings.NotificationsEnabled ?? false)
            {
                if (!IsValidEmail(smtpSection.From))
                {
                    LogManager.ErrorLog("SMTP from email address is not a valid email address");
                    return;
                }
                foreach (var email in campusLogicSection.SMTPSettings.SendTo.Split(Convert.ToChar(",")).Where(email => !IsValidEmail(email.Trim())))
                {
                    LogManager.ErrorLog($"SMTP to email address {email} is not a valid email address");
                    return;
                }
                if (smtpSection.DeliveryMethod != SmtpDeliveryMethod.Network && smtpSection.DeliveryMethod != SmtpDeliveryMethod.SpecifiedPickupDirectory && smtpSection.DeliveryMethod != SmtpDeliveryMethod.PickupDirectoryFromIis)
                {
                    LogManager.ErrorLog($"SMTP delivery method {smtpSection.DeliveryMethod} is not a valid delivery method");
                    return;
                }
                if (smtpSection.DeliveryMethod == SmtpDeliveryMethod.Network)
                {
                    if (!smtpSection.Network.DefaultCredentials && (string.IsNullOrEmpty(smtpSection.Network.UserName.Trim()) || string.IsNullOrEmpty(smtpSection.Network.Password.Trim())))
                    {
                        LogManager.ErrorLog("SMTP network credentials (username or password) are missing");
                        return;
                    }
                }
                if (smtpSection.DeliveryMethod == SmtpDeliveryMethod.SpecifiedPickupDirectory && string.IsNullOrEmpty(smtpSection.SpecifiedPickupDirectory.PickupDirectoryLocation))
                {
                    LogManager.ErrorLog("Specified Pickup Directory was indicated as the delivery method for SMTP but no pickup directory location was specified ");
                }
            }
        }

        /// <summary>
        /// Gets a cron expression, based on value passed in
        /// </summary>
        /// <param name="minutes"></param>
        /// <returns></returns>
        private string GetCronExpressionByMinutes(string minutes)

        {
            string cronExpression = string.Empty;

            /* When working with minutes in a Cron expression, the max allowed value is 59. 
             * See if they have set a value higher than 59 minutes -- if so, use the appropriate Cron method
             * to run at the desired interval (every x days, every x hours, every x minutes, etc) 
             */
            var convertedTime = Convert.ToDouble(minutes);
            var timeInDays = TimeSpan.FromMinutes(convertedTime).Days;
            var timeInHours = TimeSpan.FromMinutes(convertedTime).Hours;

            if (timeInDays >= 1)
            {
                //Run every x days
                cronExpression = 0 + " " + 0 + " " + $"*/{timeInDays} * *";
            }
            else if (timeInHours == 24)
            {
                //Run once a day, everyday
                cronExpression = Cron.Daily();
            }
            else if (timeInHours == 1)
            {
                //Run every hour, on the hour.
                cronExpression = Cron.Hourly();
            }
            else if (timeInHours >= 1 && timeInHours < 24 && timeInDays == 0)
            {
                //Run every x hours
                cronExpression = 0 + " " + $"*/{timeInHours}" + " " + "* * *";
            }
            else
            {
                //Default cron expression (every x minutes)
                cronExpression = "*/" + minutes + " " + "*" + " " + "*" + " " + "*" + " " + "*";
            }
            return cronExpression;
        }

        /// <summary>
        /// Checking the configurations and setting them 
        /// for the automated ISIR Upload process
        /// </summary>
        private void AutomatedISIRUpload()
        {
            //validation
            if (campusLogicSection.ISIRUploadSettings == null)
            {
                NotificationService.ErrorNotification("Automated ISIR Upload", "ISIR Upload settings are missing from the config file");
                LogManager.ErrorLog("ISIR Upload settings are missing");
                return;
            }

            UploadConfigurationValidation(new UploadSettings
            {
                UploadEnabled = campusLogicSection.ISIRUploadSettings.ISIRUploadEnabled ?? false,
                UploadFilePath = campusLogicSection.ISIRUploadSettings.ISIRUploadFilePath,
                ArchiveFilePath = campusLogicSection.ISIRUploadSettings.ISIRArchiveFilePath,
                UploadFrequencyType = campusLogicSection.ISIRUploadSettings.ISIRUploadFrequencyType,
                DaysToRun = campusLogicSection.ISIRUploadSettings.ISIRUploadDaysToRun,
                UploadType = UploadSettings.ISIR
            });
        }

        /// <summary>
        /// Checking the configurations and setting them 
        /// for the automated AwardLetter Upload process
        /// </summary>
        private void AutomatedAwardLetterUpload()
        {
            //validation
            if (campusLogicSection.AwardLetterUploadSettings == null)
            {
                NotificationService.ErrorNotification("Automated AwardLetter Upload", "The award letter upload settings are missing");
                LogManager.ErrorLog("Award Letter Upload settings are missing");
                return;
            }

            UploadConfigurationValidation(new UploadSettings
            {
                UploadEnabled = campusLogicSection.AwardLetterUploadSettings.AwardLetterUploadEnabled ?? false,
                UploadFilePath = campusLogicSection.AwardLetterUploadSettings.AwardLetterUploadFilePath,
                CheckSubDirectories = campusLogicSection.AwardLetterUploadSettings.AwardLetterUploadCheckSubDirectories ?? false,
                ArchiveFilePath = campusLogicSection.AwardLetterUploadSettings.AwardLetterArchiveFilePath,
                UploadFrequencyType = campusLogicSection.AwardLetterUploadSettings.AwardLetterUploadFrequencyType,
                DaysToRun = campusLogicSection.AwardLetterUploadSettings.AwardLetterUploadDaysToRun,
                UploadType = UploadSettings.AwardLetter
            });
        }

        /// <summary>
        /// Checking the configurations and setting them
        /// for the automated AwardLetter File Mapping upload 
        /// process
        /// </summary>
        private void AutomatedFileMappingUpload()
        {
            //validation
            if (campusLogicSection.FileMappingUploadSettings == null)
            {
                NotificationService.ErrorNotification("Automated AwardLetter File Mapping Upload", "The award letter file mapping settings are missing");
                LogManager.ErrorLog("Award Letter File Mapping Upload settings are missing");
                return;
            }

            UploadConfigurationValidation(new UploadSettings
            {
                UploadEnabled = campusLogicSection.FileMappingUploadSettings.FileMappingUploadEnabled ?? false,
                UploadFilePath = campusLogicSection.FileMappingUploadSettings.FileMappingUploadFilePath,
                ArchiveFilePath = campusLogicSection.FileMappingUploadSettings.FileMappingArchiveFilePath,
                UploadFrequencyType = campusLogicSection.FileMappingUploadSettings.FileMappingUploadFrequencyType,
                DaysToRun = campusLogicSection.FileMappingUploadSettings.FileMappingUploadDaysToRun,
                UploadType = UploadSettings.FileMapping
            });
        }

        /// <summary>
        /// Checking the configurations and setting them
        /// for the automated Data File upload process
        /// </summary>
        private void AutomatedDataFileUpload()
        {
            //validation
            if (campusLogicSection.DataFileUploadSettings == null)
            {
                NotificationService.ErrorNotification("Automated Data File Mapping Upload", "The data file settings are missing");
                LogManager.ErrorLog("Data File Upload settings are missing");
                return;
            }

            UploadConfigurationValidation(new UploadSettings
            {
                UploadEnabled = campusLogicSection.DataFileUploadSettings.DataFileUploadEnabled ?? false,
                UploadFilePath = campusLogicSection.DataFileUploadSettings.DataFileUploadFilePath,
                ArchiveFilePath = campusLogicSection.DataFileUploadSettings.DataFileArchiveFilePath,
                UploadFrequencyType = campusLogicSection.DataFileUploadSettings.DataFileUploadFrequencyType,
                DaysToRun = campusLogicSection.DataFileUploadSettings.DataFileUploadDaysToRun,
                UploadType = UploadSettings.DataFile,
                CheckSubDirectories = true
            });
        }

        /// <summary>
        /// Checking the configurations and setting them
        /// for the automated Secure File Transfer process
        /// </summary>
        private void AutomatedSecureFileUpload()
        {
            //validation
            if (campusLogicSection.DataFileUploadSettings == null)
            {
                NotificationService.ErrorNotification("Automated Data File Mapping Upload", "The data file settings are missing");
                LogManager.ErrorLog("Data File Upload settings are missing");
                return;
            }

            UploadConfigurationValidation(new UploadSettings
            {
                UploadEnabled = campusLogicSection.DataFileUploadSettings.DataFileUploadEnabled ?? false,
                UploadFilePath = $"{campusLogicSection.DataFileUploadSettings.DataFileUploadFilePath}\\{UploadSettings.SecureFileTransfer}",
                ArchiveFilePath = campusLogicSection.DataFileUploadSettings.DataFileArchiveFilePath,
                UploadFrequencyType = campusLogicSection.DataFileUploadSettings.DataFileUploadFrequencyType,
                DaysToRun = campusLogicSection.DataFileUploadSettings.DataFileUploadDaysToRun,
                UploadType = UploadSettings.SecureFileTransfer
            });
        }

        /// <summary>
        /// Checks for configurations and settings 
        /// for the automated Bulk Action process
        /// </summary>
        private void AutomatedBulkActionJob()
        {
            var bulkActionSettings = campusLogicSection.BulkActionSettings;
            string serviceName = "Automated Bulk Action";

            // validation
            if (bulkActionSettings == null)
            {
                NotificationService.ErrorNotification(serviceName, "Bulk Action settings are missing from the config file");
                LogManager.ErrorLog("Bulk Action settings are missing from the config file");
                return;
            }
            if (bulkActionSettings.BulkActionEnabled)
            {
                //Set reoccurance based on configs
                var cronValue = "";

                switch (bulkActionSettings.Frequency)
                {
                    case "daily":
                        cronValue = Cron.Daily();
                        break;
                    case "weekly":
                        cronValue = Cron.Weekly();
                        break;
                    case "minutes":
                        cronValue = Cron.Minutely();
                        break;
                    case "hourly":
                        cronValue = Cron.Hourly();
                        break;
                }

                RecurringJob.AddOrUpdate(serviceName, () => DocumentImportService.ProcessBulkAction(new BulkActionUploadDto
                {
                    FileUploadDirectory = bulkActionSettings.BulkActionUploadPath,
                    FileArchiveDirectory = bulkActionSettings.BulkActionArchivePath,
                    NotificationEmail = bulkActionSettings.NotificationEmail,
                    UseSSN = bulkActionSettings.UseSSN
                }), cronValue);
            }
            else
            {
                RecurringJob.RemoveIfExists(serviceName);
            }
        }


        /// <summary>
        /// ISIR corrections setup for automation
        /// </summary>
        private void AutomatedISIRCorrectionBatching()
        {
            const string DAILY = " * * *";

            //validation
            if (campusLogicSection.ISIRCorrectionsSettings == null)
            {
                NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", "ISIR Corrections settings are missing");
                LogManager.ErrorLog("ISIR Corrections settings are missing");
                return;
            }

            if (campusLogicSection.ISIRCorrectionsSettings.CorrectionsEnabled ?? false)
            {
                //    if (!IsValidFilePathFormat(campusLogicSection.ISIRCorrectionsSettings.CorrectionsFilePath))
                //    {
                //        NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", "Corrections file path is in incorrect format");
                //        LogManager.ErrorLog("Corrections file path is in incorrect format");
                //        return;
                //    }

                if (string.IsNullOrEmpty(campusLogicSection.ISIRCorrectionsSettings.TimeToRun))
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", "ISIR corrections enabled but TimeToRun is empty");
                    LogManager.ErrorLog("ISIR corrections enabled but TimeToRun is empty");
                    return;
                }

                if (campusLogicSection.ISIRCorrectionsSettings.DaysToRun.Split(Convert.ToChar(",")).Any(day => !_acceptedDaysToRun.Contains(day.ToUpperInvariant().Trim())))
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", ISIR_INCORRECT_FORMAT_ERROR);
                    LogManager.ErrorLog(ISIR_INCORRECT_FORMAT_ERROR);
                    return;
                }

                //Correct format is: HH:MMAM or HH:MMPM.. we will also except H:MMAM or HH:MMam(and their PM versions)
                if (!Regex.IsMatch(campusLogicSection.ISIRCorrectionsSettings.TimeToRun, @"^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]+(AM|PM|am|pm)$"))
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", ISIR_INCORRECT_FORMAT_ERROR);
                    LogManager.ErrorLog(ISIR_INCORRECT_FORMAT_ERROR);
                    return;
                }

                var amOrPm = campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Length - 2, 2).ToUpperInvariant();
                if (amOrPm != "AM" && amOrPm != "PM")
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", ISIR_INCORRECT_FORMAT_ERROR);
                    LogManager.ErrorLog(ISIR_INCORRECT_FORMAT_ERROR);
                    return;
                }

                if (campusLogicSection.ISIRCorrectionsSettings.FileExtension != "txt" && campusLogicSection.ISIRCorrectionsSettings.FileExtension != "dat" && campusLogicSection.ISIRCorrectionsSettings.FileExtension != "")
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", "ISIR corrections enabled but file extension invalid format, valid formats are txt or dat");
                    LogManager.ErrorLog(ISIR_INCORRECT_FORMAT_ERROR);
                    return;
                }

                //Converting hours to military time
                var hour = (campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(0, campusLogicSection.ISIRCorrectionsSettings.TimeToRun.IndexOf(":")) == "12" && amOrPm == "AM") ? "0" : amOrPm == "PM" ? (int.Parse(campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(0, campusLogicSection.ISIRCorrectionsSettings.TimeToRun.IndexOf(":"))) + 12).ToString() : campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(0, campusLogicSection.ISIRCorrectionsSettings.TimeToRun.IndexOf(":"));
                var minutes = campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(campusLogicSection.ISIRCorrectionsSettings.TimeToRun.IndexOf(":") + 1, 2) == "00" ? "0" : campusLogicSection.ISIRCorrectionsSettings.TimeToRun.Substring(campusLogicSection.ISIRCorrectionsSettings.TimeToRun.IndexOf(":") + 1, 2);

                if (!IsDigitsOnly(hour) || !IsDigitsOnly(minutes))
                {
                    NotificationService.ErrorNotification("Automated ISIR Corrections Batch Processing", "ISIR corrections enabled but TimeToRun invalid format");
                    LogManager.ErrorLog("ISIR corrections enabled but TimeToRun invalid format");
                    return;
                }

                //Set reoccurance based on configs
                RecurringJob.AddOrUpdate(() => ISIRService.ISIRCorrections(), minutes + " " + hour + DAILY);
                //For easy testing, uncomment this line
                //RecurringJob.AddOrUpdate(() => ISIRService.ISIRCorrections(), Cron.Minutely);
            }
            else
            {
                RecurringJob.RemoveIfExists("ISIRService.ISIRCorrections");
            }
        }

        /// <summary>
        /// Validate all of the configurations for a
        /// file upload process (ISIR or Award Letter)
        /// </summary>
        /// <param name="uploadSettings"></param>
        private void UploadConfigurationValidation(UploadSettings uploadSettings)
        {
            if (uploadSettings.UploadEnabled)
            {
                if (uploadSettings.UploadType != UploadSettings.AwardLetter && uploadSettings.UploadType != UploadSettings.ISIR 
                    && uploadSettings.UploadType != UploadSettings.FileMapping && uploadSettings.UploadType != UploadSettings.DataFile
                    && uploadSettings.UploadType != UploadSettings.SecureFileTransfer)
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"The upload type of {uploadSettings.UploadType} is not a valid upload type");
                    LogManager.ErrorLog($"{uploadSettings.UploadType} is not a valid upload type");
                    return;
                }
                if (string.IsNullOrEmpty(uploadSettings.ArchiveFilePath))
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Upload archive file path is missing");
                    LogManager.ErrorLog($"{uploadSettings.UploadType} Upload archive file path is missing");
                    return;
                }

                if (string.IsNullOrEmpty(uploadSettings.UploadFilePath))
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Upload upload file path is missing");
                    LogManager.ErrorLog($"{uploadSettings.UploadType} Upload upload file path is missing");
                    return;
                }

                //if (!IsValidFilePathFormat(uploadSettings.ArchiveFilePath))
                //{
                //    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Upload archive file path is in incorrect format");
                //    LogManager.ErrorLog($"{uploadSettings.UploadType} Archive file path is in incorrect format");
                //    return;
                //}

                //if (!IsValidFilePathFormat(uploadSettings.UploadFilePath))
                //{
                //    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Upload upload file path is in incorrect format");
                //    LogManager.ErrorLog($"{uploadSettings.UploadType} Upload file path is in incorrect format");
                //    return;
                //}

                var acceptedUploadFrequencies = new List<string> { "daily", "weekly", "minutes", "hourly" };
                if (!acceptedUploadFrequencies.Contains(uploadSettings.UploadFrequencyType))
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Upload frequency type is not in correct format");
                    LogManager.ErrorLog($"{uploadSettings.UploadType} Upload frequency type is not in correct format");
                    return;
                }

                if (uploadSettings.DaysToRun.Split(Convert.ToChar(",")).Any(day => !_acceptedDaysToRun.Contains(day.ToUpperInvariant().Trim())))
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload", $"{uploadSettings.UploadType} Days to Run is not in correct format");
                    LogManager.ErrorLog($"{uploadSettings.UploadType} Days to Run is not in correct format");
                    return;
                }

                //Set reoccurance based on configs
                var cronValue = "";

                switch (uploadSettings.UploadFrequencyType)
                {
                    case "daily":
                        cronValue = Cron.Daily();
                        break;
                    case "weekly":
                        cronValue = Cron.Weekly();
                        break;
                    case "minutes":
                        cronValue = Cron.Minutely();
                        break;
                    case "hourly":
                        cronValue = Cron.Hourly();
                        break;
                }

                RecurringJob.AddOrUpdate(uploadSettings.UploadType, () => UploadService.Upload(uploadSettings), cronValue);
            }
            else
            {
                RecurringJob.RemoveIfExists(uploadSettings.UploadType);
            }

        }

        /// <summary>
        /// Validates configuration for the document import feature,
        /// then adds a background job if valid.
        /// </summary>
        private void AutomatedDocumentImportWorker()
        {
            DocumentImportSettings config = campusLogicSection.DocumentImportSettings;
            string serviceName = DocumentImportService.Name;

            if (config == null)
            {
                NotificationService.ErrorNotification(serviceName, $"The {serviceName} settings are missing");
                LogManager.ErrorLog($"The {serviceName} settings are missing");
                return;
            }

            if (config.Enabled)
            {
                if (string.IsNullOrEmpty(config.ArchiveDirectory))
                {
                    NotificationService.ErrorNotification(serviceName, $"{serviceName} archive directory empty");
                    LogManager.ErrorLog($"{serviceName} archive directory empty");
                    return;
                }

                if (string.IsNullOrEmpty(config.FileDirectory))
                {
                    NotificationService.ErrorNotification(serviceName, $"{serviceName} file directory empty");
                    LogManager.ErrorLog($"{serviceName} file directory path empty");
                    return;
                }

                var acceptedUploadFrequencies = new List<string> { "daily", "weekly", "minutes", "hourly" };
                if (!acceptedUploadFrequencies.Contains(config.Frequency))
                {
                    NotificationService.ErrorNotification(serviceName, $"{serviceName} frequency not valid");
                    LogManager.ErrorLog($"{serviceName} frequency not valid");
                    return;
                }

                //Set reoccurance based on configs
                var cronValue = "";

                switch (config.Frequency)
                {
                    case "daily":
                        cronValue = Cron.Daily();
                        break;
                    case "weekly":
                        cronValue = Cron.Weekly();
                        break;
                    case "minutes":
                        cronValue = Cron.Minutely();
                        break;
                    case "hourly":
                        cronValue = Cron.Hourly();
                        break;
                }

                RecurringJob.AddOrUpdate(serviceName, () => DocumentImportService.ProcessImports(new DocumentImportSettingsDto
                {
                    ArchiveDirectory = config.ArchiveDirectory,
                    FileDirectory = config.FileDirectory,
                    FileExtension = config.FileExtension,
                    HasHeaderRow = config.HasHeaderRow,
                    UseSSN = config.UseSSN
                }), cronValue);
            }
            else
            {
                RecurringJob.RemoveIfExists(serviceName);
            }
        }

        /// <summary>
        /// Deletes all batch process jobs, but will ensure processes that were updated or altogether deleted do not appear.
        /// </summary>
        private void RemoveBatchProcesses()
        {
            List<RecurringJobDto> recurringJobs = JobStorage.Current.GetConnection().GetRecurringJobs();
            List<string> jobIds = new List<string>();

            foreach (var recurringJob in recurringJobs)
            {
                jobIds.Add(recurringJob.Id);
            }

            foreach (var batchProcessingType in campusLogicSection.BatchProcessingTypes.GetBatchProcessingTypes())
            {
                var batchJobIds = jobIds.Where(b => b.StartsWith(batchProcessingType.TypeName));

                foreach (var batchJobId in batchJobIds)
                {
                    RecurringJob.RemoveIfExists(batchJobId);
                }
            }
        }

        /// <summary>
        /// Adds background jobs for all batch processes.
        /// </summary>
        private void AutomatedBatchProcessingJob()
        {
            // Does the BatchProcessRecord table exist? If not, create it.
            VerifyBatchProcessRecordTableExists();

            VerifyNewBatchProcessColumnsExist();

            RemoveBatchProcesses();

            bool? batchProcessingEnabled = campusLogicSection.BatchProcessingTypes.BatchProcessingEnabled;

            if (batchProcessingEnabled == true)
            {
                foreach (var batchProcessingType in campusLogicSection.BatchProcessingTypes.GetBatchProcessingTypes())
                {
                    var type = batchProcessingType.TypeName;

                    foreach (var batchProcess in batchProcessingType.GetBatchProcesses())
                    {
                        var name = batchProcess.BatchName;
                        var size = batchProcess.MaxBatchSizeAsInt;
                        var minutes = batchProcess.BatchExecutionMinutes;

                        RecurringJob.AddOrUpdate(string.Format("{0}.{1}", type, name), () => BatchProcessingService.RunBatchProcess(type, name, size),
                        GetCronExpressionByMinutes(minutes));
                    }
                }
            }
        }

        /// <summary>
        /// Adds background job for PowerFAIDS batching.
        /// </summary>
        private void AutomatedPowerFaidsJob()
        {
            VerifyPowerFaidsRecordTableExists();

            bool? powerFaidsEnabled = campusLogicSection.PowerFaidsSettings.PowerFaidsEnabled;

            if (powerFaidsEnabled == true && campusLogicSection.PowerFaidsSettings != null && campusLogicSection.PowerFaidsSettings.IsBatch == true && !string.IsNullOrEmpty(campusLogicSection.PowerFaidsSettings.BatchExecutionMinutes))
            {
                //Set reoccurance based on configs
                string minutes = campusLogicSection.PowerFaidsSettings.BatchExecutionMinutes;
                RecurringJob.AddOrUpdate(() => PowerFaidsService.RunBatchPowerFaidsProcess(), GetCronExpressionByMinutes(minutes));
            }
            else
            {
                RecurringJob.RemoveIfExists("PowerFaidsService.RunBatchPowerFaidsProcess");
            }
        }

        /// <summary>
        /// Check if value is numerical
        /// </summary>
        /// <param name="str"></param>
        /// <returns></returns>
        private bool IsDigitsOnly(string str)
        {
            return str.All(c => c >= '0' && c <= '9');
        }

        /*
        /// <summary>
        /// Check if file path follows format of :
        /// Begin with x:\ or \\
        ///  valid characters are a-z| 0-9|-|.|_ 
        /// </summary>
        /// <param name="path"></param>
        /// <returns></returns>
        private bool IsValidFilePathFormat(string path)
        {
            return Regex.IsMatch(path, @"^(?:[a-zA-Z]\:|\\\\[\w\.]+\\[\w.$]+)\\(?:[\w]+\\)*\w([\w.])+$");
        }
        */

        /// <summary>
        /// Validating an email address via regex
        /// </summary>
        /// <param name="emailAddress"></param>
        /// <returns></returns>
        private bool IsValidEmail(string emailAddress)
        {
            if (String.IsNullOrEmpty(emailAddress))
                return false;

            // Use IdnMapping class to convert Unicode domain names.
            try
            {
                emailAddress = Regex.Replace(emailAddress, @"(@)(.+)$", DomainMapper,
                                      RegexOptions.None, TimeSpan.FromMilliseconds(200));
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }

            // Return true if emailAddress is in valid e-mail format.
            try
            {
                return Regex.IsMatch(emailAddress,
                      @"^(?("")("".+?(?<!\\)""@)|(([0-9a-z]((\.(?!\.))|[-!#\$%&'\*\+/=\?\^`\{\}\|~\w])*)(?<=[0-9a-z])@))" +
                      @"(?(\[)(\[(\d{1,3}\.){3}\d{1,3}\])|(([0-9a-z][-\w]*[0-9a-z]*\.)+[a-z0-9][\-a-z0-9]{0,22}[a-z0-9]))$",
                      RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(250));
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        }

        /// <summary>
        /// Verifies that the EventNotification table exists in LocalDB and if it doesn't, creates it.
        /// </summary>
        private static void VerifyEventNotificationTableExists()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventNotification]'))" +
                        "BEGIN CREATE TABLE[dbo].[EventNotification]" +
                        "([Id] INT IDENTITY NOT NULL PRIMARY KEY" +
                        ",[EventNotificationId] INT NOT NULL" +
                        ",[Message] VARCHAR(MAX) NOT NULL" +
                        ",[CreatedDateTime] DATETIME NOT NULL" +
                        ",[ProcessGuid] UNIQUEIDENTIFIER NULL)" +
                        "CREATE INDEX ProcessGuid_Event ON [dbo].[EventNotification] ([ProcessGuid]) END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the EventNotification table in LocalDB: {ex}");
                }
            }
        }

        /// <summary>
        /// Verifies that the BatchProcessRecord table exists in LocalDB and if it doesn't, creates it.
        /// </summary>
        private static void VerifyBatchProcessRecordTableExists()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[BatchProcessRecord]'))" +
                        "BEGIN CREATE TABLE[dbo].[BatchProcessRecord]" +
                        "([Id] INT IDENTITY NOT NULL PRIMARY KEY" +
                        ",[Type] VARCHAR(200) NOT NULL" +
                        ",[Name] VARCHAR(25) NOT NULL" +
                        ",[Message] VARCHAR(MAX) NOT NULL" +
                        ",[ProcessGuid] UNIQUEIDENTIFIER NULL" +
                        ",[RetryCount] int NULL" +
                        ",[RetryUpdatedDate] datetime NULL)" +
                        "CREATE INDEX ProcessGuid_Event ON [dbo].[BatchProcessRecord] ([ProcessGuid]) END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the BatchProcessRecord table in LocalDB: {ex}");
                }
            }
        }

        /// <summary>
        /// Adding two columns that were added after we 
        /// deployed this batch process (if need be)
        /// </summary>
        private static void VerifyNewBatchProcessColumnsExist()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'RetryCount' and object_id = OBJECT_ID(N'[dbo].[BatchProcessRecord]'))" +
                        "BEGIN ALTER TABLE [dbo].[BatchProcessRecord]" +
                        "ADD [RetryCount] INT NULL" +
                        ",[RetryUpdatedDate] DATETIME NULL; END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the new columns for the BatchProcessRecord table in LocalDB: {ex}");
                }
            }
        }

        /// <summary>
        /// Verifies that the PowerFaidsRecord table exists in LocalDB and if it doesn't, creates it.
        /// </summary>
        private static void VerifyPowerFaidsRecordTableExists()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[PowerFaidsRecord]'))" +
                        "BEGIN CREATE TABLE[dbo].[PowerFaidsRecord]" +
                        "([Id] INT IDENTITY NOT NULL PRIMARY KEY" +
                        ",[Json] VARCHAR(MAX) NOT NULL" +
                        ",[ProcessGuid] UNIQUEIDENTIFIER NULL)" +
                        "CREATE INDEX ProcessGuid_Event ON [dbo].[PowerFaidsRecord] ([ProcessGuid]) END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the PowerFaidsRecord table in LocalDB: {ex}");
                }
            }
        }

        /// <summary>
        /// Verifies that the EventProperty table exists in LocalDB and if it doesn't, creates it.
        /// </summary>
        private static void VerifyEventPropertyTableExists()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventProperty]'))" +
                        "BEGIN CREATE TABLE[dbo].[EventProperty]" +
                        "([Id] INT NOT NULL" +
                        ",[Name] NVARCHAR(200) NOT NULL" +
                        ",[DisplayName] NVARCHAR(200) NOT NULL" +
                        ",[DisplayFormula] NVARCHAR(2000) NOT NULL" +
                        ",CONSTRAINT [PK_EventProperty] PRIMARY KEY ([Id])" +
                        ",CONSTRAINT [AK_DisplayName] UNIQUE([DisplayName])) END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the EventProperty table in LocalDB: {ex}");
                }
            }
        }

        private static void VerifyEventPropertyNewColumnsExist()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE name = N'CallbackEndpoint' and object_id = OBJECT_ID(N'[dbo].[EventProperty]'))" +
                        "BEGIN ALTER TABLE [dbo].[EventProperty]" +
                        "ADD [CallbackEndpoint] NVARCHAR(500) NULL" +
                        ",[CallbackFileEndpoint] NVARCHAR(500) NULL; END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the new columns for the BatchProcessRecord table in LocalDB: {ex}");
                }
            }
        }
        private static void VerifyEventPropertyOldColumnsExist()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF EXISTS (SELECT 1 FROM sys.columns WHERE name = N'CallbackEndpoint' and object_id = OBJECT_ID(N'[dbo].[EventProperty]'))" +
                        "BEGIN ALTER TABLE [dbo].[EventProperty]" +
                        "DROP COLUMN [CallbackEndpoint], [CallbackFileEndpoint]; END");
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the new columns for the BatchProcessRecord table in LocalDB: {ex}");
                }
            }
        }
        private static void VerifyEventNotificationDefinitionTableExists()
        {
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    dbContext.Database.ExecuteSqlCommand(
                        "IF NOT EXISTS(SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventNotificationDefinition]'))" +
                        "BEGIN CREATE TABLE[dbo].[EventNotificationDefinition]" +
                        "([Id] int NOT NULL" +
                        ",[ProductId] uniqueidentifier NULL" +
                        ",[EventName] NVARCHAR(100) NOT NULL" +
                        ",[CallbackEndpoint] NVARCHAR(500) NULL" +
                        ",[CallbackFileEndpoint] NVARCHAR(500) NULL" +
                        ",[IsActive] BIT NOT NULL" +
                        ",CONSTRAINT [PK_EventNotificationDefinition] PRIMARY KEY CLUSTERED ([Id] ASC));" +
                        " END");

                    dbContext.Database.ExecuteSqlCommand(
                         "IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[EventNotificationEventProperty]'))" +
                        "BEGIN CREATE TABLE[dbo].[EventNotificationEventProperty]" +
                        "([EventNotificationId] int  NOT NULL," +
                        " [EventPropertyId] int  NOT NULL," +
                        "CONSTRAINT [PK_EventNotificationEventProperty] PRIMARY KEY CLUSTERED ([EventNotificationId], [EventPropertyId] ASC)," +
                        "CONSTRAINT [FK_EventNotificationDefinitionEventNotificationEventProperty] FOREIGN KEY([EventNotificationId])" +
                        "REFERENCES [dbo].[EventNotificationDefinition] ([Id])," +
                        "CONSTRAINT [FK_EventPropertyEventNotificationEventProperty] FOREIGN KEY([EventPropertyId])" +
                        "REFERENCES [dbo].[EventProperty] ([Id])); " +
                        "END"
                        );
                }
                catch (Exception ex)
                {
                    LogManager.ErrorLog($"There was an issue with validating and/or creating the EventNotificationDefinition table in LocalDB: {ex}");
                }
            }
        }


        /// <summary>
        /// In case the domain is for whatever reason 
        /// in unicode
        /// </summary>
        /// <param name="match"></param>
        /// <returns></returns>
        private string DomainMapper(Match match)
        {
            // IdnMapping class with default property values.
            IdnMapping idn = new IdnMapping();

            string domainName = match.Groups[2].Value;

            domainName = idn.GetAscii(domainName);

            return match.Groups[1].Value + domainName;
        }
        /// <summary>
        /// Send error notification and return
        /// information to be logged back in web
        /// layer
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="errorMessage"></param>
        /// <returns></returns>
        private static NotificationData SendErrorNotification(string operation, string errorMessage, Exception ex = null)
        {
            if (campusLogicSection.SMTPSettings.NotificationsEnabled ?? false)
            {
                return ex == null ? notificationManager.SendErrorNotification(operation, errorMessage).Result : notificationManager.SendErrorNotification(operation, ex).Result;
            }
            else
            {
                return new NotificationData();
            }
        }
    }


}