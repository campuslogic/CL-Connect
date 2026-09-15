using System.Web.Optimization;

namespace CampusLogicEvents.Web
{
	public class BundleConfig
    {
        // For more information on Bundling, visit http://go.microsoft.com/fwlink/?LinkId=254725
        public static void RegisterBundles(BundleCollection bundles)
        {
            bundles.Add(new StyleBundle("~/Content/css")
                .Include("~/Content/site.css")
                .Include("~/Content/app.css")
                .Include("~/Content/bootstrap.min.css"));

            bundles.Add(new StyleBundle("~/Content/fontawesome/css")
                .Include("~/Content/fontawesome/font-awesome.css", new CssRewriteUrlTransform()));

#if DEBUG

            BundleTable.EnableOptimizations = false;

#else

            BundleTable.EnableOptimizations = true;

#endif
        }
    }
}
