using CampusLogicEvents.Implementation;
using CampusLogicEvents.Web.Filters;
using System;
using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;
using System.Web.Http;


namespace CampusLogicEvents.Web.WebAPI
{
    [LocalRequestOnly]
    public class ExportController : ApiController
    {
        public ExportController()
        {
        }

        [HttpPost]
        [Route("api/Export/ExportLogs")]
        public HttpResponseMessage ExportLogs([FromBody] ExportRequest request)
        {
            var exportManager = new ExportManager();
            HttpResponseMessage response;
            try
            {
                exportManager.ExportLogs(request.Days, request.Tables);
                response = new HttpResponseMessage(HttpStatusCode.OK)
                {
                    Content = new StringContent("Logs exported successfully")
                };
            }
            catch (Exception)
            {
                response = new HttpResponseMessage(HttpStatusCode.InternalServerError)
                {
                    Content = new StringContent("Error exporting logs")
                };
            }

            return response;
        }
    }

    public class ExportRequest
    {
        public int Days { get; set; }
        public List<string> Tables { get; set; }
    }
}