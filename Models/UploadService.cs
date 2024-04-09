using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Models;
using Hangfire;

namespace CampusLogicEvents.Web.Models
{
	public static class UploadService
    {
        
        /// <summary>
        /// File Upload - Run on a scheduled basis.  Configured in the Startup.cs and the web.config
        /// Checks specified folder to see if files are present, if so uploads and moves to archive
        /// --This currently works for both ISIR Upload and Award Letter
        /// </summary>
        [AutomaticRetry(Attempts = 0)]
        public static void Upload(UploadSettings uploadSettings)
        {
            //If today is not one of the configured days to run the job, then break
            if (!uploadSettings.DaysToRun.Split(Convert.ToChar(",")).Any(day => DateTime.UtcNow.DayOfWeek.ToString().ToUpperInvariant().Contains(day.ToUpperInvariant().Trim())))
            {
                return;
            }

            NotificationManager notificationManager = new NotificationManager();

            try
            {
                DocumentManager manager = new DocumentManager();

                //Check permissions on upload path first
                if (!manager.ValidateDirectory(uploadSettings.UploadFilePath))
                {
                    NotificationService.ErrorNotification($"Automated {uploadSettings.UploadType} Upload Process", $"The upload file path {uploadSettings.UploadFilePath} does not authorize read and write updates");
                    throw new Exception($"The upload file path {uploadSettings.UploadFilePath} does not authorize read and write updates");
                }

                //Get list of files to upload, ignore base folder for data files, we only accept sub folder items
                var filesToUpload = new List<string>();
                if(uploadSettings.UploadType != UploadSettings.DataFile)
                {
                    filesToUpload.AddRange(Directory.GetFiles(uploadSettings.UploadFilePath));
                }
                

                if((uploadSettings.UploadType == UploadSettings.AwardLetter || uploadSettings.UploadType == UploadSettings.DataFile) && uploadSettings.CheckSubDirectories == true) {
                    //Get files from first level sub-folders as well except the archive folder - these will be files that are not the default FileType
                    foreach(var dir in Directory.GetDirectories(uploadSettings.UploadFilePath)) {
                        if(dir.Equals(uploadSettings.ArchiveFilePath, StringComparison.CurrentCultureIgnoreCase) == true) {
                            continue;
                        }

                        filesToUpload.AddRange(Directory.GetFiles(dir));
                    }
                }

                //If no files exist end process
                if (filesToUpload.Any())
                {
                    foreach (var fileName in filesToUpload)
                    {
                        //Upload each File
                        var result = manager.UploadFile(fileName, uploadSettings, false).Result;


                        //If this was one file issue, merely log it and move on
                        if (result != HttpStatusCode.Accepted)
                        {
                            DataService.LogNotification(notificationManager.SendErrorNotification($"Automated {uploadSettings.UploadType} Upload Service", $"File upload attempt for filename {fileName} failed").Result);
                            LogManager.ErrorLogFormat("File upload attempt for filename {0} failed", fileName);
                        }
                        //If there was an issue with the service, stop processing and try again 
                        //on next configured time
                        if (result == HttpStatusCode.InternalServerError)
                        {
                            throw new Exception($"There was an error with File Upload API starting with filename {fileName}");
                        }
                    }
                }

            }
            catch (Exception ex)
            {
                DataService.LogNotification(notificationManager.SendErrorNotification($"Automated {uploadSettings.UploadType} Upload Service", ex).Result);
                LogManager.ErrorLogFormat("UploadService Upload {1} Error: {0}", ex, uploadSettings.UploadType);
            }

        }
    }
}