using CampusLogicEvents.Implementation;
using CampusLogicEvents.Implementation.Configurations;
using System;
using System.Configuration;
using System.IO;
using System.Net;
using System.Reflection;
using System.Web;
using System.Web.Configuration;
using System.Web.Http;
using System.Web.Mvc;
using System.Web.Optimization;
using System.Web.Routing;
using System.Xml;
using System.Linq;

namespace CampusLogicEvents.Web
{
	// Note: For instructions on enabling IIS6 or IIS7 classic mode, 
	// visit http://go.microsoft.com/?LinkId=9394801

	public class WebApiApplication : System.Web.HttpApplication
    {
        protected void Application_Start()
        {
            try
            {
                UpdateBindingRedirects();
            }
            catch
            {
                // do nothing. We don't want to force an infinite-loop of restarts each time the Web.config is saved
            }

            GlobalConfiguration.Configuration.Formatters.JsonFormatter.SerializerSettings.ReferenceLoopHandling = Newtonsoft.Json.ReferenceLoopHandling.Ignore;
            AreaRegistration.RegisterAllAreas();

            WebApiConfig.Register(GlobalConfiguration.Configuration);
            FilterConfig.RegisterGlobalFilters(GlobalFilters.Filters);
            RouteConfig.RegisterRoutes(RouteTable.Routes);
            BundleConfig.RegisterBundles(BundleTable.Bundles);

            // Allow TLS 1.0, 1.1 and 1.2 for outbound requests
            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12 | SecurityProtocolType.Tls11;
        }

        protected void Application_End()
        {
            LogManager.InfoLog("The application has been shut down.");
        }

        private void UpdateBindingRedirects()
        {
            string path = System.Web.Hosting.HostingEnvironment.MapPath("~/bin");
            string directoryName = Path.GetDirectoryName(path);

            AssemblyName assembly = AssemblyName.GetAssemblyName(path + "\\Microsoft.Data.OData.dll");
            string version = assembly.Version.ToString();

            FileInfo configFile = new FileInfo(directoryName + "/web.config");

            XmlDocument doc = new XmlDocument();
            doc.Load(configFile.DirectoryName + "/web.config");

            XmlNamespaceManager manager = new XmlNamespaceManager(doc.NameTable);
            manager.AddNamespace("bindings", "urn:schemas-microsoft-com:asm.v1");
            XmlNodeList dependentAssemblyNodes = doc.DocumentElement.SelectNodes("//bindings:dependentAssembly", manager);

            if (dependentAssemblyNodes == null)
            {
                throw (new Exception("Invalid Configuration File"));
            }

            bool updated = false;
            foreach (XmlNode dependentAssembly in dependentAssemblyNodes)
            {
                bool found = false;
                foreach (XmlNode childNode in dependentAssembly)
                {
                    if (childNode.LocalName.ToLower() != "assemblyidentity")
                    {
                        continue;
                    }

                    if ((string.Equals(childNode.Attributes["name"].Value, "Microsoft.Data.OData", StringComparison.InvariantCultureIgnoreCase)) ||
                       (string.Equals(childNode.Attributes["name"].Value, "Microsoft.Data.Edm", StringComparison.InvariantCultureIgnoreCase)) ||
                       (string.Equals(childNode.Attributes["name"].Value, "System.Spatial", StringComparison.InvariantCultureIgnoreCase)))
                    {
                        found = true;
                    }
                }

                if (found)
                {
                    foreach (XmlNode childNode in dependentAssembly)
                    {
                        if (childNode.LocalName.ToLower() != "bindingredirect")
                        {
                            continue;
                        }

                        if (childNode.Attributes["oldVersion"].Value != $"0.0.0.0-{version}")
                        {
                            childNode.Attributes["oldVersion"].Value = $"0.0.0.0-{version}";
                            updated = true;
                        }

                        if (childNode.Attributes["newVersion"].Value != $"{version}")
                        {
                            childNode.Attributes["newVersion"].Value = $"{version}";
                            updated = true;
                        }
                    }
                }
            }

            if (updated)
            {
                doc.Save(configFile.DirectoryName + "/web.config");
            }
        }
    }
}