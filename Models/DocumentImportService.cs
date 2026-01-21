using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Models;
using CsvHelper;
using Hangfire;
using Newtonsoft.Json.Linq;
using CampusLogicEvents.Web.Results;
using System.Threading.Tasks;

namespace CampusLogicEvents.Web.Models
{
	public static class DocumentImportService
	{
		public const string Name = "Document Import"; // Used for logging purposes and also to identify the Hangfire recurring job.
		private static readonly NotificationManager notificationManager = new NotificationManager();


		/// <summary>
		/// Checks a specified folder to see if index files are present.  Each index file
		/// contains records that indicate a document to be uploaded for a student.  Once
		/// each record is processed, the index file is archived so that it is not run again.
		/// Associated documents for each record in the index file are only archived if they 
		/// were successfully processed.
		/// </summary>
		[AutomaticRetry(Attempts = 0)]
		public static void ProcessImports(DocumentImportSettingsDto importSettings)
		{
			DocumentManager manager = new DocumentManager();

			// Check read/write permissions.
			if (!manager.ValidateDirectory(importSettings.FileDirectory) ||
				!manager.ValidateDirectory(importSettings.ArchiveDirectory))
			{
				NotificationService.ErrorNotification(Name, $"{Name} does not authorize read and write updates");
				LogManager.ErrorLog($"{Name} does not authorize read and write updates");
				throw new Exception($"{Name} does not authorize read and write updates");
			}

			// Get all files to process.
			string[] filesToProcess =
				Directory.GetFiles(importSettings.FileDirectory)
					.Where(fileName => fileName.EndsWith(importSettings.FileExtension))
					.Select(fileName => Path.Combine(importSettings.FileDirectory, fileName))
					.ToArray();

			foreach (string filePath in filesToProcess)
			{
				var records = new List<DocumentImportRecord>();
				var failedRecords = new List<DocumentImportRecord>();

				try
				{
					using (StreamReader sr = new StreamReader(filePath))
					{
						// Parse the file using CsvHelper library.
						using (CsvReader csvReader = new CsvReader(sr))
						{
							csvReader.Configuration.RegisterClassMap<DocumentImportRecordCsvMap>();
							csvReader.Configuration.HasHeaderRecord = importSettings.HasHeaderRow;

							records = csvReader.GetRecords<DocumentImportRecord>().Select(record =>
							{
								// Manually set file path for use later.
								record.FilePath = Path.Combine(importSettings.FileDirectory, record.FileName);
								return record;
							}).ToList();
						}
						sr.Close();
						sr.Dispose();
					}
				}
				catch (Exception ex)
				{
					string message = "File was not in the correct format.\n\nDetails:\n\n" + ex;
					CreateFailuresFile(importSettings.ArchiveDirectory, filePath, failureMessage: message);
				}

				// Send each document to StudentVerification for processing.
				foreach (DocumentImportRecord record in records)
				{
					try
					{
						HttpResponseMessage result = Task.Run(()=> manager.ImportDocument(record, importSettings)).Result;
						if (result.IsSuccessStatusCode)
						{
							// Archive the document once we are done with it.
							ArchiveFile(record.FilePath, importSettings.ArchiveDirectory);
						}
						else
						{
							if (result.Content == null)
							{
								// Never hit the API...failed validation.
								throw new Exception(result.ReasonPhrase);
							}
							else
							{
								// Get the message returned from the API.
								string jsonStringResponse = Task.Run(() => result.Content.ReadAsStringAsync()).Result;

								// Try to parse the JSON.
								string message = null;
								try
								{
									JObject json = JObject.Parse(jsonStringResponse);
									message = json["message"].Value<string>();
								}
								catch (Exception) { }

								throw new Exception(message ?? jsonStringResponse);
							}
						}
					}
					catch (Exception ex)
					{
						record.FailureReason = ex.Message;
						failedRecords.Add(record);
					}
				}

				// Done.  Now archive the file and create a failures file, if necessary.
				ArchiveFile(filePath, importSettings.ArchiveDirectory);
				CreateFailuresFile(importSettings.ArchiveDirectory, filePath, failedRecords: failedRecords);
			}
		}


        /// <summary>
        /// Takes whatever files are in the bulk action upload directory
        /// and posts them to SV to begin the Bulk Action process
        /// </summary>
        [AutomaticRetry(Attempts = 0)]
		public static void ProcessBulkAction(BulkActionUploadDto bulkActionUpload)
		{

            try
            {
                LogManager.BulkActionInfo("ProcessBulkAction enter");

                DocumentManager manager = new DocumentManager();

                // Check read/write permissions.
                if (!manager.ValidateDirectory(bulkActionUpload.FileUploadDirectory) ||
                    !manager.ValidateDirectory(bulkActionUpload.FileArchiveDirectory))
                {
                    NotificationService.ErrorNotification("Bulk Action", $"{bulkActionUpload.FileUploadDirectory} does not authorize read and write updates");
                    LogManager.BulkActionError($"{bulkActionUpload.FileUploadDirectory} does not authorize read and write updates");
                    throw new Exception($"{bulkActionUpload.FileUploadDirectory} does not authorize read and write updates");
                }


                LogManager.BulkActionInfo($"Loading files from \"{bulkActionUpload.FileUploadDirectory}\"");// Get all files to process.
                string[] filesToProcess =
                    Directory.GetFiles(bulkActionUpload.FileUploadDirectory) 
                        .Select(fileName => Path.Combine(bulkActionUpload.FileUploadDirectory, fileName))
                        .ToArray();

                foreach (string f in filesToProcess)
                {
                    var filePath = f;
                    LogManager.BulkActionInfo($"Processing file \"{filePath}\"");

                    try
                    {
                        var directory = Path.GetDirectoryName(filePath);
                        var prefix = Path.Combine(directory, Path.GetFileNameWithoutExtension(filePath));
                        var extension = Path.GetExtension(filePath);

                        //Note that while processing a file in the Upload directory, we rename it to provide for status
                        //indication and also to help handle situations where archiving fails, or when the server resets.

                        //1234.csv --> not yet processed.
                        //1234.working.csv --> currently being processed, but not yet uploaded to student forms.
                        //1234.complete.csv --> successfully uploaded to student forms
                        //1234.failed.csv --> rejected by student forms

                        if (prefix.EndsWith(BulkActionConstants.Working, StringComparison.InvariantCultureIgnoreCase))
                        {
                            //This can happen if the server reset before we had an opportunity to fully upload the file.
                            //Let's just reprocess.
                            LogManager.InfoLog($"Encountered a working file.  Reprocessing: \"{filePath}\"");
                        }
                        else if (prefix.EndsWith(BulkActionConstants.Complete, StringComparison.InvariantCultureIgnoreCase)
                            || prefix.EndsWith(BulkActionConstants.Failed, StringComparison.InvariantCultureIgnoreCase))
                        {
                            try
                            {
                                LogManager.BulkActionInfo($"Encountered an already-processed file \"{filePath}\", attempting to archive");
                                ArchiveFile(filePath, bulkActionUpload.FileArchiveDirectory);
                            }
                            catch (Exception ex)
                            {
                                LogManager.BulkActionError(ex);
                            }

                            //At this point, we're done processing the completed file - either with success or failure.  Let's 
                            //continue on to the next file.
                            continue;
                        }
                        else
                        {
                            //We've encountered a file that's ready for processing.  We first rename it to .working to indicate that
                            //the file is currently being processed.  
                            RenameFile(ref filePath, prefix, BulkActionConstants.Working, extension);
                        }

                        HttpResponseMessage result = Task.Run(() => manager.UploadBulkAction(bulkActionUpload, filePath)).Result;

                        LogManager.BulkActionInfo($"Bulk action upload completed with {result.StatusCode}");

                        if (result.IsSuccessStatusCode)
                        {
                            //Rename the file to .complete and then attempt to archive it.
                            RenameAndArchive(ref filePath, prefix, BulkActionConstants.Complete, extension, bulkActionUpload);
                        }
                        else
                        {
                            if (result.Content == null)
                            {
                                // Never hit the API...failed validation.
                                throw new Exception(result.ReasonPhrase);
                            }
                            else
                            {
                                // Build error message to send to notitification service 
                                var importResult = Task.Run(() => result.Content.ReadAsAsync<ImportResult>()).Result;

                                //Rename the file to .failed and then attempt to archive it.
                                RenameAndArchive(ref filePath, prefix, BulkActionConstants.Failed, extension, bulkActionUpload);

                                throw new Exception(FormatImportResultMessage(importResult, filePath));
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        LogManager.BulkActionError(ex);

                        try
                        {
                            LogManager.BulkActionInfo($"Attempting to send notification email to: \"{bulkActionUpload.NotificationEmail}\"");
                            // what to do if a file fails...
                            var response = Task.Run(() => notificationManager.SendErrorNotification("ProcessBulkAction", ex.Message, bulkActionUpload.NotificationEmail)).Result;

                            if (response.SendCompleted.HasValue)
                            {
                                LogManager.BulkActionInfo("Send notification email completed without error");
                            }
                            else
                            {
                                LogManager.BulkActionInfo("Send notification email failed");
                            }
                            
                        }
                        catch (Exception ex2)
                        {
                            LogManager.BulkActionError($"Send notification email failed with error: \"{ex2.Message}\"");
                        }
                    }
                }
            }
            finally
            {
                LogManager.BulkActionInfo("ProcessBulkAction exit");
            }
		}

        private static void RenameFile(ref string filePath, string prefix, string suffix, string extension)
        {
            try
            {
                var newFilePath = $"{prefix}{suffix}{extension}";

                LogManager.BulkActionInfo($"Attempting to rename file: \"{filePath}\" --> \"{newFilePath}\"");

                File.Move(filePath, newFilePath);
                filePath = newFilePath;
            }
            catch (Exception ex)
            {
                throw new Exception($"Failed to rename bulk-action file: {ex.Message}");
            }
        }

        private static void RenameAndArchive(ref string filePath, string prefix, string suffix, string extension, BulkActionUploadDto bulkActionUpload)
        {
            try
            {
                if (prefix.EndsWith(BulkActionConstants.Working, StringComparison.InvariantCultureIgnoreCase))
                {
                    var idx = prefix.LastIndexOf(BulkActionConstants.Working);
                    prefix = prefix.Substring(0, idx);
                }

                RenameFile(ref filePath, prefix, suffix, extension);
            }
            catch (Exception ex)
            {
                LogManager.BulkActionError($"Upload succeeded, but failed to rename file: {ex.Message}");
            }

            try
            {
                ArchiveFile(filePath, bulkActionUpload.FileArchiveDirectory);
            }
            catch (Exception ex)
            {
                LogManager.BulkActionError($"Upload succeeded, but failed to archive file: {ex.Message}");
            }
        }

		private static string FormatImportResultMessage(ImportResult result, string filePath)
		{
			string message = $"Error in file {Path.GetFileName(filePath)}" + Environment.NewLine;
			foreach(var error in result.TopErrors)
			{
				message += $"Error found in row: {error.RowNum}, error message: {error.ErrorMessage}" + Environment.NewLine;
			}
			return message;
		}


		/// <summary>
		/// Archives a file by moving it to the specified archive directory.
		/// </summary>
		/// <param name="filePath">Path of the file to archive.</param>
		/// <param name="archiveDirectory">Directory to move the file to.</param>
		private static void ArchiveFile(string filePath, string archiveDirectory)
		{
			// Validate args
			if (string.IsNullOrWhiteSpace(filePath) || string.IsNullOrWhiteSpace(archiveDirectory))
			{
				return;
			}

			if (File.Exists(filePath))
			{
				string fileName = Path.GetFileName(filePath);
                string fileExtension = Path.GetExtension(filePath);

                string archiveFilePathPrefix = Path.Combine(archiveDirectory, fileName);

                archiveFilePathPrefix = Path.Combine(archiveDirectory, Path.GetFileNameWithoutExtension(archiveFilePathPrefix));

                if (archiveFilePathPrefix.EndsWith(BulkActionConstants.Complete, StringComparison.InvariantCultureIgnoreCase)
                    || archiveFilePathPrefix.EndsWith(BulkActionConstants.Failed, StringComparison.InvariantCultureIgnoreCase)
                    || archiveFilePathPrefix.EndsWith(BulkActionConstants.Working, StringComparison.InvariantCultureIgnoreCase))
                {
                    //Strip off the status indicator.
                    var idx = archiveFilePathPrefix.LastIndexOf('.');
                    archiveFilePathPrefix = archiveFilePathPrefix.Substring(0, idx);
                }

                //Include a timestamp with the new filename to ensure uniqueness.
                archiveFilePathPrefix = $"{archiveFilePathPrefix} {DateTime.Now.ToString(DocumentManager.TimeStampFormat)}";

                var archiveFilePath = $"{archiveFilePathPrefix}{fileExtension}";

                //At this point, the new file name should be unique.  We still need some defensive code, however, to handle
                //the case where there still is a naming conflict.  In that case, we just append a number on the end.

                int n = 1;
                while (File.Exists(archiveFilePath))
                    archiveFilePath = $"{archiveFilePathPrefix} ({n++}){fileExtension}";

                LogManager.InfoLog($"Moving file \"{filePath}\" --> \"{archiveFilePath}\"");

				File.Move(filePath, archiveFilePath);

                //TODO: should we auto-clean up the archive directory once it gets too full?
			}
		}

		/// <summary>
		/// Creates a file that contains any failure message(s).  Only 1 parameter should be provided.
		/// </summary>
		/// <param name="fileNameOrPath">The name of or path to the original file.  The failures file will use this name and append a .failures extension.</param>
		/// <param name="failedRecords">If provided, creates a CSV file with a list of failed records.</param>
		/// <param name="failureMessage">If provided, creates a text file with a failure message.</param>
		/// <param name="directory">The directory to put the failure file in.</param>
		private static void CreateFailuresFile(string directory, string fileNameOrPath, List<DocumentImportRecord> failedRecords = null, string failureMessage = null)
		{
			// Validate args
			if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(fileNameOrPath) ||
				((failedRecords as object ?? failureMessage as object) == null))
			{
				return;
			}

			string fileName = Path.GetFileName(fileNameOrPath);
			string failureFilePath = Path.Combine(directory, fileName + ".failures");

			using (StreamWriter sw = new StreamWriter(failureFilePath))
			{
				// Create a new CSV file containing any failed records.
				if (failedRecords != null && failedRecords.Any())
				{
					// Append header row.
					sw.WriteLine("Student ID, Document Name, File Name,Award Year,Failure Reason");

					// Append row per failed record.
					foreach (DocumentImportRecord record in failedRecords)
					{
						sw.WriteLine(
							$"{record.Identifier},\"{record.DocumentName}\",\"{record.FileName}\",\"{record.AwardYearRaw}\",{record.FailureReason}");
					}
				}
				// Otherwise a file with just a message in it.
				else if (!string.IsNullOrWhiteSpace(failureMessage))
				{
					sw.WriteLine(failureMessage);
				}

				sw.Close();
				sw.Dispose();

			}
		}

	}
}