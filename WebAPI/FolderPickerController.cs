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

                //Clean up the requested path, then make sure it is still somewhere under c:\
                //before we go look at it on disk
                var directory = CleanUpPath(Path.Combine(root, directoryPath));

                if (!directory.StartsWith(root, StringComparison.OrdinalIgnoreCase))
                {
                    throw new HttpException(403, "Access denied");
                }

                var info = new DirectoryInfo(directory);

                //These are the subfolders returned per the path that was requested
                var entries = info.EnumerateFileSystemInfos()
                                       .Where(f => !f.Attributes.HasFlag(FileAttributes.Hidden) && f.Attributes == FileAttributes.Directory)
                                       .Select(entry => new
                                       {
                                           Path = Path.Combine(directory, entry.Name),
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
                //ValidateDirectory creates the folder if it does not exist yet, so clean up what
                //came in on the request and only pass the cleaned value along.
                //We cannot limit this one to c:\ the way the folder explorer does, because the
                //archive and upload folders people configure are often on another drive or on a
                //network share. Instead we require a complete path, which is what keeps folders
                //from getting created next to the web application itself.
                var directory = CleanUpPath(directoryPath);

                if (!IsCompletePath(directory))
                {
                    throw new HttpException(403, "Access denied");
                }

                DocumentManager documentManager = new DocumentManager();
                return documentManager.ValidateDirectory(directory) ? new HttpResponseMessage(HttpStatusCode.OK) : new HttpResponseMessage(HttpStatusCode.ExpectationFailed);
            }
            catch (Exception ex)
            {
                LogManager.ErrorLogFormat("TestWritePermissions Get Error: {0}", ex);
                return Request.CreateResponse(HttpStatusCode.ExpectationFailed);
            }
        }

        /// <summary>
        /// Cleans up a folder path that came in on a request and turns down anything that could
        /// never be a real one. Always use what this returns, not what the request sent.
        /// </summary>
        private static string CleanUpPath(string requestedPath)
        {
            if (string.IsNullOrWhiteSpace(requestedPath)
                || requestedPath.IndexOfAny(Path.GetInvalidPathChars()) >= 0)
            {
                throw new HttpException(403, "Access denied");
            }

            //GetFullPath works out where the path really points, so shortcuts like "..\.." that
            //back out of a folder are gone by the time we use it. Anything it cannot make sense
            //of at all (wildcards, a path that is too long) throws, and the caller's catch
            //turns that into an error response.
            return Path.GetFullPath(requestedPath);
        }

        /// <summary>
        /// A complete path names its own drive (c:\...) or a network share (\\server\share).
        /// Something like \folder or folder\sub is not complete: Windows fills in the missing part
        /// from wherever the web application happens to be running, which is not what we want.
        /// </summary>
        private static bool IsCompletePath(string path)
        {
            if (path.StartsWith(@"\\", StringComparison.Ordinal))
            {
                return true;
            }

            return path.Length >= 3
                   && char.IsLetter(path[0])
                   && path[1] == ':'
                   && (path[2] == Path.DirectorySeparatorChar || path[2] == Path.AltDirectorySeparatorChar);
        }
    }
}