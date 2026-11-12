using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using CampusLogicEvents.Implementation.Models;
using Hangfire;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using System;
using System.Collections.Generic;
using System.Configuration;
using System.IO;
using System.Linq;
using System.Text;
using System.Xml.Linq;

namespace CampusLogicEvents.Web.Models
{
    public static class PowerFaidsService
    {
        private static readonly NotificationManager notificationManager = new NotificationManager();
        private static readonly CampusLogicSection campusLogicConfigSection = (CampusLogicSection)ConfigurationManager.GetSection(ConfigConstants.CampusLogicConfigurationSectionName);
        

        [AutomaticRetry(Attempts = 0)]
        public static void RunBatchPowerFaidsProcess()
        {
            Guid processGuid = Guid.NewGuid();
            using (var dbContext = new CampusLogicContext())
            {
                // Get all records to process
                var records = dbContext.PowerFaidsRecords.Where(p => p.ProcessGuid == null);

                if (records.Any())
                {
                    // Lock to prevent from being processed again
                    dbContext.Database.ExecuteSqlCommand($"update [dbo].[PowerFaidsRecord] set [ProcessGuid] = '{processGuid}' from [dbo].[PowerFaidsRecord] where [Id] in (select [Id] from [dbo].[PowerFaidsRecord] where [ProcessGuid] is NULL)");

                    // Get the records to process
                    var recordsToProcess = dbContext.PowerFaidsRecords.Where(p => p.ProcessGuid == processGuid).Select(p => p).ToList();

                    var powerFaidsList = new List<PowerFaidsDto>();

                    foreach (var record in recordsToProcess)
                    {
                        try
                        {
                            PowerFaidsDto powerFaidsRecord = JsonConvert.DeserializeObject<PowerFaidsDto>(record.Json);
                            powerFaidsList.Add(powerFaidsRecord);
                        }
                        catch (Exception)
                        {
                            dynamic data = JObject.Parse(record.Json);
                            NotificationService.ErrorNotification("PowerFAIDS", $"Error occurred while processing PowerFAIDS record. EventId: {data.EventId}");
                            // Delete the bad record
                            dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[PowerFaidsRecord] WHERE [Id] = {record.Id}");
                        }
                    }

                    try
                    {
                        ProcessPowerFaidsRecords(powerFaidsList);
                    }
                    catch (Exception)
                    {
                        NotificationService.ErrorNotification("PowerFAIDS", $"Error occurred while generating XML. Affected events: {string.Join(", ", powerFaidsList.Select(x => x.EventId).ToList())}");
                    }

                    // Delete the records to never be processed again!
                    dbContext.Database.ExecuteSqlCommand($"DELETE FROM [dbo].[PowerFaidsRecord] WHERE [ProcessGuid] = '{processGuid}'");
                }
            }
        }

        public static void ProcessPowerFaidsRecords(List<PowerFaidsDto> powerFaidsRecords)
        {
            // Setup the XML
            var fileData = new StringBuilder();

            XNamespace xsi = "http://www.w3.org/2001/XMLSchema-instance";
            XNamespace commonImport = "http://collegeboard.org/CommonImport";

            // The `commonImport` namespace prefix is necessary to prevent an exception being thrown by LINQ to XML, but should not appear in file.
            var xml = new XElement(commonImport + "CommonImport",
                new XAttribute("StudentRecordCount", powerFaidsRecords.Count.ToString()),
                new XAttribute(xsi + "schemaLocation", "http://collegeboard.org/CommonImport CommonImport.xsd"),
                new XAttribute("xmlns", "http://collegeboard.org/CommonImport"),
                new XAttribute(XNamespace.Xmlns + "xsi", "http://www.w3.org/2001/XMLSchema-instance"));

            var fileName = "PowerFAIDSExport_" + DateTime.UtcNow.ToString("MM-dd-yyyy_HH-mm-ss.fff") + ".xml";
            var fullFile = Path.Combine(powerFaidsRecords[0].FilePath, fileName);

            foreach (var powerFaidsRecord in powerFaidsRecords)
            {
                // The `commonImport` namespace must be prefixed on all XElements 
                // to prevent an empty "xmlns" attribute from appearing on the node
                var studentElement = new XElement(commonImport + "Student");
                
                var studentIdElement = new XElement(commonImport + "StudentID");
                studentIdElement.Add(new XElement(commonImport + "AwardYearToken", powerFaidsRecord.AwardYearToken));
                studentElement.Add(studentIdElement);

                var studentNameElement = new XElement(commonImport + "StudentName");
                studentNameElement.Add(new XElement(commonImport + "AlternateID", powerFaidsRecord.AlternateId));
                studentElement.Add(studentNameElement);


                var documentsElement = new XElement(commonImport + "Documents");
                var documentElement = new XElement(commonImport + "Document");

                var fmDataElement = new XElement(commonImport + "FMData");

                // Add values to file
                switch (powerFaidsRecord.Outcome)
                {
                    case "documents":
                        documentElement.Add(new XElement(commonImport + "ShortName", powerFaidsRecord.ShortName));
                        documentElement.Add(new XElement(commonImport + "RequiredFor", powerFaidsRecord.RequiredFor));
                        documentElement.Add(new XElement(commonImport + "Status", powerFaidsRecord.Status));
                        documentElement.Add(new XElement(commonImport + "EffectiveDate", powerFaidsRecord.EffectiveDate));
                        documentElement.Add(new XElement(commonImport + "Lock", powerFaidsRecord.DocumentLock));
                        documentsElement.Add(documentElement);
                        studentElement.Add(documentsElement);
                        break;
                    case "verification":
                        fmDataElement.Add(new XElement(commonImport + "VerifOutcome", powerFaidsRecord.VerificationOutcome));
                        fmDataElement.Add(new XElement(commonImport + "VerifOutcomeLock", powerFaidsRecord.VerificationOutcomeLock == "Y" ? "1" : "0"));
                        studentElement.Add(fmDataElement);
                        break;
                    case "both":
                        documentElement.Add(new XElement(commonImport + "ShortName", powerFaidsRecord.ShortName));
                        documentElement.Add(new XElement(commonImport + "RequiredFor", powerFaidsRecord.RequiredFor));
                        documentElement.Add(new XElement(commonImport + "Status", powerFaidsRecord.Status));
                        documentElement.Add(new XElement(commonImport + "EffectiveDate", powerFaidsRecord.EffectiveDate));
                        documentElement.Add(new XElement(commonImport + "Lock", powerFaidsRecord.DocumentLock));
                        documentsElement.Add(documentElement);

                        fmDataElement.Add(new XElement(commonImport + "VerifOutcome", powerFaidsRecord.VerificationOutcome));
                        fmDataElement.Add(new XElement(commonImport + "VerifOutcomeLock", powerFaidsRecord.VerificationOutcomeLock == "Y" ? "1" : "0"));

                        studentElement.Add(documentsElement);
                        studentElement.Add(fmDataElement);
                        break;
                    default:
                        break;
                }

                xml.Add(studentElement);
            }

            fileData.Clear();
            fileData.AppendLine(xml.ToString());

            //Write the file out
            File.WriteAllText(fullFile, fileData.ToString());
        }
    }
}