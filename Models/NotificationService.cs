using CampusLogicEvents.Implementation;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Net.Configuration;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using System.Threading.Tasks;

namespace CampusLogicEvents.Web.Models
{
	public static class NotificationService
    {
        private static readonly CampusLogicSection campusLogicSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);
        private static readonly NotificationManager notificationManager = new NotificationManager();

        /// <summary>
        ///We have this to ensure that the Notifications
        ///are turned on before we even attempt to hit both 
        /// the email send and emai log
        /// methods (since they have to live in
        /// seperate projects)
        /// </summary>
        ///<param name="operation"></param>
        /// <param name="errorMessage"></param>
        public static void ErrorNotification(string operation, string errorMessage)
        {
            if (campusLogicSection.SMTPSettings.NotificationsEnabled ?? false)
            {
                DataService.LogNotification(notificationManager.SendErrorNotification(operation, errorMessage).Result);
            }
        }

        public static async Task ErrorNotification(SmtpSection smtpSection, string sendTo)
        {
            DataService.LogNotification(await notificationManager.TestSMTP(smtpSection, sendTo));
        }

        /// <summary>
        /// Overload 
        /// </summary>
        /// <param name="operation"></param>
        /// <param name="exception"></param>
        public static void ErrorNotification(string operation, Exception exception)
        {
            if (campusLogicSection.SMTPSettings.NotificationsEnabled ?? false)
            {
                DataService.LogNotification(notificationManager.SendErrorNotification(operation, exception).Result);
            }
        }

        /// <summary>
        /// Log already sent emails
        /// </summary>
        /// <param name="errorNotificationList"></param>
        public static void LogNotifications(IList<NotificationData> errorNotificationList)
        {
            foreach (var errorNotificaitonToLog in errorNotificationList.Where(errorNotificaitonToLog => errorNotificaitonToLog.SendCompleted != null))
            {
                DataService.LogNotification(errorNotificaitonToLog);
            }
        }
    }
}