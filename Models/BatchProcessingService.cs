using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using Hangfire;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.Linq;
using System.Threading.Tasks;
using CampusLogicEvents.Implementation.Extensions;
using Newtonsoft.Json.Linq;
using CampusLogicEvents.Web.Filters;

namespace CampusLogicEvents.Web.Models
{
    public static class BatchProcessingService
    {
        private static readonly int RETRY_MAX = 3;
        private static readonly NotificationManager notificationManager = new NotificationManager();
        private static readonly CampusLogicSection campusLogicConfigSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);

        [AutomaticRetry(Attempts = 0)]
        [DisableConcurrentExecution(60)]
        [BatchProcessingFailure]
        public static void RunBatchProcess(string type, string name, int size)
        {

            LogManager.InfoLog("enter batch processing");
            Guid processGuid = Guid.NewGuid();
            using (var dbContext = new CampusLogicContext())
            {
                try
                {
                    // Get all records in our LocalDB to process
                    var records = dbContext.BatchProcessRecords.Where(b => b.Name == name && b.Type == type && b.ProcessGuid == null);

                    if (records.Any())
                    {
                        // Lock these records from being processed again
                        dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [ProcessGuid] = '{processGuid}' FROM [dbo].[BatchProcessRecord] WHERE [Id] IN (SELECT [Id] FROM [dbo].[BatchProcessRecord] WHERE [Type] = '{type}' AND [Name] = '{name}' AND [ProcessGuid] IS NULL)");

                        // Ensure there are locked records with this process guid
                        if (dbContext.BatchProcessRecords.Any(b => b.ProcessGuid != null && b.ProcessGuid == processGuid))
                        {
                            if (type == ConfigConstants.AwardLetterPrintBatchType)
                            {
                                var manager = new DocumentManager();
                                Dictionary<int, Guid> recordIds = new Dictionary<int, Guid>();

                                var recordList = dbContext.BatchProcessRecords.Where(b => b.ProcessGuid == processGuid).ToList();
                                // Get all records with this process guid
                                foreach (var record in recordList)
                                {
                                    // Deserialize the message
                                    var eventData = new EventNotificationData(JObject.Parse(record.Message));

                                    //Track retry attempts
                                    var now = DateTime.Now;
                                    var processSingularly = false;
                                    var retryTimeHasPassed = !record.RetryUpdatedDate.HasValue || record.RetryUpdatedDate.Value.AddHours(1) < DateTime.Now;
                                    if (record.RetryCount == null)
                                    {
                                        record.RetryCount = 1;
                                        dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [RetryCount] = 1, [RetryUpdatedDate] = '{now}' FROM [dbo].[BatchProcessRecord] WHERE [Id] = {record.Id}");
                                    }
                                    else if (retryTimeHasPassed || record.RetryCount == RETRY_MAX)
                                    {
                                        record.RetryCount = record.RetryCount + 1;
                                        dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [RetryCount] = [RetryCount] + 1, [RetryUpdatedDate] = '{now}'  FROM [dbo].[BatchProcessRecord] WHERE [Id] = {record.Id}");
                                    }

                                    if (eventData.PropertyValues[EventPropertyConstants.AlRecordId].IsNullOrEmpty())
                                    {
                                        SendErrorNotification("Batch AwardLetter process", $"This record has no AL-record-Id, record Id: {eventData.PropertyValues[EventPropertyConstants.Id].Value<string>()}. This likely means the notification event is not an AL event.  Please contact your CampusLogic contact for next steps.");
                                        LogManager.ErrorLog($"Record for batch awardletter process has no AL-record-Id, with award letter record Id: {eventData.PropertyValues[EventPropertyConstants.Id].Value<string>()}.  This likely means the notification event is not an AL event");
                                        dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] = {record.Id}");
                                    }
                                    else if (record.RetryCount > RETRY_MAX)
                                    {
                                        SendErrorNotification("Batch AwardLetter process", $"This record has reached it's maximum retry attempts, record Id: {record.Id}, AL-record-Id: {Guid.Parse(eventData.PropertyValues[EventPropertyConstants.AlRecordId].Value<string>())}. Please contact your CampusLogic contact for next steps.");
                                        LogManager.ErrorLog($"Record for batch awardletter process has reached maximum retry attempts, with award letter record Id: {record.Id}, AL-record-Id: {Guid.Parse(eventData.PropertyValues[EventPropertyConstants.AlRecordId].Value<string>())}.");
                                        dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] = {record.Id}");
                                    }
                                    else if (record.RetryCount == RETRY_MAX && retryTimeHasPassed)
                                    {
                                        processSingularly = true;
                                        recordIds.Add(record.Id, Guid.Parse(eventData.PropertyValues[EventPropertyConstants.AlRecordId].Value<string>()));
                                    }
                                    else if (retryTimeHasPassed)
                                    {
                                        processSingularly = false;
                                        recordIds.Add(record.Id, Guid.Parse(eventData.PropertyValues[EventPropertyConstants.AlRecordId].Value<string>()));
                                    }

                                    if (recordIds.Count == size || processSingularly)
                                    {
                                        // Get event data for index file creation
                                        var recordIdList = string.Join(",", recordIds.Keys);
                                        var message = new EventNotificationData(JObject.Parse(dbContext.Database.SqlQuery<string>($"SELECT [Message] from [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] IN ({recordIdList})").First()));
                                        LogManager.InfoLog($"{recordIds.Values.Count()} records found to return PDFs");
                                        LogManager.InfoLog($"{recordIds.Values.Distinct().Count()} distinct records found to return PDFs");
                                        var response = Task.Run(async ()=> await manager.GetBatchAwardLetterPdfFile(processGuid, recordIds.Values.Distinct().ToList(), name, message)).ConfigureAwait(false).GetAwaiter().GetResult();
                                        //If the response was successful remove those records from the db so
                                        //we do not continue to process them if the file fails
                                        if (response.IsSuccessStatusCode)
                                        {
                                            dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] IN ({recordIdList})");
                                        }
                                        recordIds.Clear();
                                    }
                                }

                                // Process the last group of records that was smaller than the batch size
                                if (recordIds.Any())
                                {
                                    var recordIdList = string.Join(",", recordIds.Keys);
                                    var message = new EventNotificationData(JObject.Parse(dbContext.Database.SqlQuery<string>($"SELECT [Message] from [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] IN ({recordIdList})").First()));
                                    LogManager.InfoLog($"{recordIds.Values.Count()} records found to return PDFs");
                                    LogManager.InfoLog($"{recordIds.Values.Distinct().Count()} distinct records found to return PDFs");
                                    var response = Task.Run(async () => await manager.GetBatchAwardLetterPdfFile(processGuid, recordIds.Values.ToList(), name, message)).ConfigureAwait(false).GetAwaiter().GetResult();
                                    if (response.IsSuccessStatusCode)
                                    {
                                        dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[BatchProcessRecord] WHERE [ProcessGuid] = '{processGuid}' and [Id] IN ({recordIdList})");
                                    }
                                }
                                dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processGuid}'");
                            }
                        }
                    }
                }

                catch (TaskCanceledException ex)
                {
                    LogManager.ErrorLog($"The task was canceled: {ex}");
                    if (ex.InnerException != null)
                    {
                        LogManager.ErrorLog($"Inner exception: {ex.InnerException}");
                    }
                    throw ex;
                }
                catch (Exception e)
                {
                    //Something happened during processing. Update any records that may have been marked for processing back to null so that they can be re-processed.
                    LogManager.ErrorLog($"An error occured while attempting to execute the batch process: {e}");
                    throw e;
                }
                finally
                {
                    dbContext.Database.ExecuteSqlCommand($"UPDATE [dbo].[BatchProcessRecord] SET [ProcessGuid] = NULL WHERE [ProcessGuid] = '{processGuid}'");
                }
            }
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
            if (campusLogicConfigSection.SMTPSettings.NotificationsEnabled ?? false)
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