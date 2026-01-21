using CampusLogicEvents.Implementation;
using System;
using System.Configuration;
using System.Linq;
using CampusLogicEvents.Implementation.Configurations;
using Hangfire;

namespace CampusLogicEvents.Web.Models
{
    public static class ISIRService
    {
        private static readonly CampusLogicSection campusLogicConfigSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);


        /// <summary>
        /// Batches ISIR Corrections
        /// Runs on a daily scheduled basis.  Configured in the Startup.cs and the web.config
        /// </summary>
        [AutomaticRetry(Attempts = 0)]
        public static void ISIRCorrections()
        {
            try
            {
                //If today is not one of the configured days to run the job, then break
                if (!campusLogicConfigSection.ISIRCorrectionsSettings.DaysToRun.Split(Convert.ToChar(",")).Any(day => DateTime.UtcNow.DayOfWeek.ToString().ToUpperInvariant().Contains(day.ToUpperInvariant().Trim())))
                {
                    return;
                }

                DocumentManager manager = new DocumentManager();

                //Batch todays ISIR Corretions
                var batchResult = manager.BatchISIRCorrections().Result;

                //Log all(if any) of the error emails sent during the Automated ISIR Batch process
                NotificationService.LogNotifications(batchResult.NotificationDataList);

                if (campusLogicConfigSection.ISIRCorrectionsSettings.TdClientEnabled.HasValue && campusLogicConfigSection.ISIRCorrectionsSettings.TdClientEnabled.Value == true)
                {
                    var tdClientResult = manager.SendTdClientISIRCorrections();

                    //Log all(if any) of the error emails sent during the Automated ISIR Batch process
                    NotificationService.LogNotifications(tdClientResult.NotificationDataList);
                }
            }
            catch (Exception ex)
            {
                NotificationService.ErrorNotification("Automated ISIR Corrections Process", ex);
                LogManager.ErrorLogFormat("ISIRService ISIR Correction Error: {0}", ex);
            }

        }

    }
}