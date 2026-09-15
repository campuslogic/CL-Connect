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
        /// The "All" handler, which DataService falls back to for any event with no handler of its own.
        /// </summary>
        private const int CatchAllEventNotificationId = 0;

        /// <summary>
        /// Processes the File Store Job for one named file store.
        /// </summary>
        /// <param name="storeName">
        /// The store to flush. Startup registers one recurring job per store, each on that store's
        /// own interval.
        /// </param>
        [AutomaticRetry(Attempts = 0)]
        public static void ProcessFileStore(string storeName)
        {
            var store = campusLogicConfigSection.FileStoreSettings.ResolveStore(storeName);
            if (store == null)
            {
                LogManager.ErrorLog($"File store '{storeName}' is no longer configured; skipping.");
                return;
            }

            //The event ids routed to THIS store, and the catch-all handler if this store owns it.
            //A blank fileStoreName belongs to the first store, which is what every event carries in a
            //configuration written before file stores were named
            var ownedEventIds = FileStoreHandlers().Where(h => IsRoutedTo(h, store) && h.EventNotificationId != CatchAllEventNotificationId)
                .Select(h => h.EventNotificationId).Distinct().ToList();

            var catchAll = FileStoreHandlers().FirstOrDefault(h => h.EventNotificationId == CatchAllEventNotificationId);
            var ownsCatchAll = catchAll != null && IsRoutedTo(catchAll, store);

            //No events to process against
            if (!ownedEventIds.Any() && !ownsCatchAll)
            {
                return;
            }

            var claim = $"[EventNotificationId] IN ({Ids(ownedEventIds)})";
            if (ownsCatchAll)
            {
                var explicitIds = FileStoreHandlers().Select(h => h.EventNotificationId)
                    .Where(id => id != CatchAllEventNotificationId).Distinct().ToList();
                claim = $"({claim} OR [EventNotificationId] NOT IN ({Ids(explicitIds)}))";
            }

            //Guid to be applied to the records in the EventNotification table
            Guid processGuid = Guid.NewGuid();

            using (var dbContext = new CampusLogicContext())
            {
                //1. Create GUID
                //2. Assign GUID to this store's existing records in LocalDB table that have null ProcessGuid
                //3. Write to file(s)
                //4. Rinse & Repeat every x minutes.
                try
                {
                    List<int> successEventIds = new List<int>();
                    List<int> failEventIds = new List<int>();

                    //Claim only the records routed to this store.
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = '{processGuid}' WHERE [ProcessGuid] IS NULL AND {claim}");

                    var claimed = dbContext.EventNotifications.Where(e => e.ProcessGuid == processGuid)
                        .Select(m => new { id = m.Id, eventNotificationId = m.EventNotificationId, message = m.Message })
                        .ToList();

                    //Group the claimed rows the way their handler asks for: everything Shared into one
                    //file, everything Individual into one file per event notification id.
                    var shared = new Dictionary<int, EventNotificationData>();
                    var individual = new Dictionary<int, Dictionary<int, EventNotificationData>>();

                    foreach (var eventRec in claimed)
                    {
                        var handler = HandlerFor(eventRec.eventNotificationId);
                        if (handler == null)
                        {
                            continue;
                        }
                        var eventData = new EventNotificationData(JObject.Parse(eventRec.message));
                        if (handler.FileStoreType == "Individual")
                        {
                            if (!individual.ContainsKey(eventRec.eventNotificationId))
                            {
                                individual.Add(eventRec.eventNotificationId, new Dictionary<int, EventNotificationData>());
                            }
                            individual[eventRec.eventNotificationId].Add(eventRec.id, eventData);
                        }
                        else
                        {
                            shared.Add(eventRec.id, eventData);
                        }
                    }

                    if (shared.Count > 0)
                    {
                        //send the list of events over to be processed into a file
                        FileStoreManager filestoreManager = new FileStoreManager();
                        filestoreManager.CreateFileStoreFile(store, shared, ref successEventIds, ref failEventIds);

                        CleanEventNotificationRecords(processGuid, ref successEventIds, ref failEventIds);
                    }

                    //Process any events configured for individual store into separate files (e.g., all 104 events in one file, all 105 in another)
                    foreach (var group in individual.Values)
                    {
                        FileStoreManager filestoreManager = new FileStoreManager();
                        filestoreManager.CreateFileStoreFile(store, group, ref successEventIds, ref failEventIds);

                        CleanEventNotificationRecords(processGuid, ref successEventIds, ref failEventIds);
                    }

                    //No row may keep this run's guid. CleanEventNotificationRecords has deleted what
                    //succeeded and released what failed, so anything still holding it was claimed and
                    //never written — release it rather than let DataCleanup purge it unwritten.
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processGuid}'");
                }
                catch (Exception ex)
                {
                    //Something happened during processing. Update any records that may have been marked for processing back to null so that they can be re-processed.
                    LogManager.ErrorLog($"An error occured while attempting to process the event(s) for file store: {ex}");
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[EventNotification] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processGuid}'");
                }
            }
        }

        /// <summary>
        /// The handlers that write to a file store. Every other handle method is irrelevant here:
        /// DataService only inserts EventNotification rows for these two.
        /// </summary>
        private static IEnumerable<EventNotificationHandler> FileStoreHandlers()
        {
            return campusLogicConfigSection.EventNotifications.Cast<EventNotificationHandler>()
                .Where(h => h.HandleMethod == "FileStore" || h.HandleMethod == "FileStoreAndDocumentRetrieval");
        }

        /// <summary>
        /// The handler for one event notification id, falling back to the catch-all exactly as
        /// DataService does when it decides to enqueue the row in the first place.
        /// </summary>
        private static EventNotificationHandler HandlerFor(int eventNotificationId)
        {
            return FileStoreHandlers().FirstOrDefault(h => h.EventNotificationId == eventNotificationId)
                ?? FileStoreHandlers().FirstOrDefault(h => h.EventNotificationId == CatchAllEventNotificationId);
        }

        /// <summary>
        /// Whether a handler writes to the given store. A blank name means the first store.
        /// </summary>
        private static bool IsRoutedTo(EventNotificationHandler handler, FileStoreSetting store)
        {
            var resolved = campusLogicConfigSection.FileStoreSettings.ResolveStore(handler.FileStoreName);
            return resolved != null && string.Equals(resolved.Name, store.Name, StringComparison.OrdinalIgnoreCase);
        }

        /// <summary>
        /// An id list for an IN clause. An empty list must still produce valid SQL that matches
        /// nothing, and -1 is never a real event notification id.
        /// </summary>
        private static string Ids(IEnumerable<int> ids)
        {
            var list = ids.ToList();
            return list.Any() ? string.Join(",", list) : "-1";
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