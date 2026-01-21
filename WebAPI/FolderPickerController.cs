using System;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Web;
using System.Web.Http;
using CampusLogicEvents.Implementation;
using CampusLogicEvents.Web.Filters;

namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class FolderPickerController : ApiController
    {
        
        /// <summary>
        /// Constructor for the FolderPickerController
        /// </summary>
        public FolderPickerController()
        {
        }

        /// <summary>
        /// Opens the folder explorer
        /// </summary>
        [HttpGet]
        public HttpResponseMessage OpenFolderExplorer(string directoryPath = "")
        {
            try
            {
                //TODO: Update for other drives
                var root = "c:\\";

                if (string.IsNullOrWhiteSpace(directoryPath))
                {
                    //Get the root for now if no value is passed in
                    directoryPath = "c:\\";
                }

                var directory = directoryPath;

                directory = Path.Combine(root, directoryPath);

                var info = new DirectoryInfo(directory);

                if (!info.FullName.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                {
                    throw new HttpException(403, "Access denied");
                }

                //These are the subfolders returned per the path that was requested
                var entries = new DirectoryInfo(directory)
                                       .EnumerateFileSystemInfos()
                                       .Where(f => !f.Attributes.HasFlag(FileAttributes.Hidden) && f.Attributes == FileAttributes.Directory)
                                       .Select(entry => new
                                       {
                                           Path = directoryPath != null ? Path.Combine(directoryPath, entry.Name) : entry.Name,
                                           Name = entry.Name,
                                           HasChildren = entry is DirectoryInfo,
                                       });

                var directoriesSerialized = Request.CreateResponse(HttpStatusCode.OK, entries);
                return directoriesSerialized;
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("OpenFolderExplorer Get Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        [HttpGet]
        public HttpResponseMessage TestWritePermissions(string directoryPath)
        {
            try
            {
                DocumentManager documentManager = new DocumentManager();
                return documentManager.ValidateDirectory(directoryPath) ? new HttpResponseMessage(HttpStatusCode.OK) : new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }
    }
}