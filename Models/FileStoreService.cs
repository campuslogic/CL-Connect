using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Runtime.InteropServices;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using Hangfire;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace CampusLogicEvents.Web.Models
{
    public static class FileStoreService
    {
        public const string Name = "File Storage";
        private static readonly CampusLogicSection campusLogicConfigSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);

        /// <summary>
        /// Processes the File Store Job 
        /// </summary>
        [AutomaticRetry(Attempts = 0)]
        public static void ProcessFileStore()
        {
            //Guid to be applied to the records in the EventNotification table
            Guid processGuid = Guid.NewGuid();

            using (var dbContext = new CampusLogicContext())
            {
                //1. Create GUID
                //2. Assign GUID to all existing records in LocalDB table that have null ProcessGuid
                //3. Write to file(s)
                //4. Rinse & Repeat every x minutes.
                try
                {
                    Dictionary<int, EventNotificationData> eventNotificationDataList = new Dictionary<int, EventNotificationData>();
                    List<int> successEventIds = new List<int>();
                    List<int> failEventIds = new List<int>();

                    //update all the current eventNotification records with no processguid to be processed.
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = '{processGuid}' WHERE [ProcessGuid] IS NULL");

                    //make sure there are events to process
                    if (dbContext.EventNotifications.Any(s => s.ProcessGuid != null && s.ProcessGuid == processGuid))
                    {
                        //Get any individual or shared FileStore events configured from the web.config
                        var individualEvents =
                            campusLogicConfigSection.EventNotifications.Cast<EventNotificationHandler>()
                                .Where(s => s.FileStoreType == "Individual").Select(e => e.EventNotificationId)
                                .ToList();

                        var sharedEvents = campusLogicConfigSection.EventNotifications.Cast<EventNotificationHandler>()
                            .Where(s => s.FileStoreType == "Shared").Select(e => e.EventNotificationId)
                            .ToList();

                        if (sharedEvents.Any())
                        {
                            //Make sure the event's processguid matches what we just generated so we're not re-processing events.
                            var sharedEventsToProcess =
                                dbContext.EventNotifications
                                .Where(e => sharedEvents.Contains(e.EventNotificationId) && e.ProcessGuid == processGuid)
                                .Select(m => new { id = m.Id, message = m.Message });

                            foreach (var eventRec in sharedEventsToProcess)
                            {
                                var eventData = new EventNotificationData(JObject.Parse(eventRec.message));

                                eventNotificationDataList.Add(eventRec.id, eventData);
                            }

                            if (eventNotificationDataList.Count > 0)
                            {
                                //send the list of events over to be processed into a file
                                FileStoreManager filestoreManager = new FileStoreManager();
                                filestoreManager.CreateFileStoreFile(eventNotificationDataList, ref successEventIds, ref failEventIds);
                                eventNotificationDataList.Clear();

                                CleanEventNotificationRecords(processGuid, ref successEventIds, ref failEventIds);
                            }
                        }

                        if (individualEvents.Any())
                        {
                            var individualEventsToProcess = dbContext.EventNotifications.Where(e => individualEvents.Contains(e.EventNotificationId) && e.ProcessGuid == processGuid);

                            //Process any events configured for individual store into separate files (e.g., all 104 events in one file, all 105 in another)
                            foreach (int eventNotificationId in individualEvents)
                            {
                                foreach (var eventRec in individualEventsToProcess.Where(s => s.EventNotificationId == eventNotificationId).Select(m => new { id = m.Id, message = m.Message }))
                                {
                                    var eventData = new EventNotificationData(JObject.Parse(eventRec.message));
                                    eventNotificationDataList.Add(eventRec.id, eventData);
                                }

                                if (eventNotificationDataList.Count > 0)
                                {
                                    FileStoreManager filestoreManager = new FileStoreManager();
                                    filestoreManager.CreateFileStoreFile(eventNotificationDataList, ref successEventIds, ref failEventIds);
                                    //clear out the list now that we've completed processing
                                    eventNotificationDataList.Clear();

                                    CleanEventNotificationRecords(processGuid, ref successEventIds, ref failEventIds);
                                }
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    //Something happened during processing. Update any records that may have been marked for processing back to null so that they can be re-processed.
                    LogManager.ErrorLog($"An error occured while attempting to process the event(s) for file store: {ex}");
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processGuid}'");
                }
            }
        }

        private static void CleanEventNotificationRecords(Guid processingGuid, ref List<int> succeededRecords, ref List<int> failedRecords)
        {
            using (var dbContext = new CampusLogicContext())
            {
                //Remove events that succeeded and reset failed events, so they can be processed again
                if (succeededRecords.Count > 0)
                {
                    dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[EventNotification] WHERE [ProcessGuid] = '{processingGuid}' and [Id] IN ({string.Join(",", succeededRecords)})");
                    succeededRecords.Clear();
                }
                if (failedRecords.Count > 0)
                {
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processingGuid}' and [Id] IN ({string.Join(",", failedRecords)})");
                    failedRecords.Clear();
                }
            }
        }
    }
}