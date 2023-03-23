using System;
using System.Collections.Generic;
using System.Web.Optimization;

namespace CampusLogicEvents.Web
{
	public class BundleConfig
    {
        // For more information on Bundling, visit http://go.microsoft.com/fwlink/?LinkId=254725
        public static void RegisterBundles(BundleCollection bundles)
        {
            bundles.Add(new Bundle("~/Content/bootstrap").Include(BootstrapJsFileNames));
            bundles.Add(new ScriptBundle("~/Content/angular").Include(AngularJsFileNames));
            bundles.Add(new ScriptBundle("~/Content/js").Include(JsFileNames));



            // Use the development version of Modernizr to develop with and learn from. Then, when you're
            // ready for production, use the build tool at http://modernizr.com to pick only the tests you need.
            bundles.Add(new ScriptBundle("~/bundles/modernizr").Include(
                        "~/Scripts/modernizr-*"));

            bundles.Add(new ScriptBundle("~/bundles/clConnectmain").Include(MainJsFiles));
            bundles.Add(new ScriptBundle("~/bundles/clConnectsetup").Include(SetupJsFiles));

            bundles.Add(new StyleBundle("~/Content/css").Include("~/Content/site.css"));

            // toastr
            bundles.Add(new StyleBundle("~/Content/toastr").Include("~/Content/toastr.css", new CssRewriteUrlTransform()));

            // Kendo styles
            bundles.Add(new StyleBundle("~/Content/kendo/css").Include(CssKendoFileNames)
            .Include("~/Content/bootstrap.min.css", new CssRewriteUrlTransform())
            .Include("~/Content/fontawesome/font-awesome.css", new CssRewriteUrlTransform()));

            bundles.Add(new StyleBundle("~/Content/themes/base/css").Include(
                        "~/Content/themes/base/jquery.ui.core.css",
                        "~/Content/themes/base/jquery.ui.resizable.css",
                        "~/Content/themes/base/jquery.ui.selectable.css",
                        "~/Content/themes/base/jquery.ui.accordion.css",
                        "~/Content/themes/base/jquery.ui.autocomplete.css",
                        "~/Content/themes/base/jquery.ui.button.css",
                        "~/Content/themes/base/jquery.ui.dialog.css",
                        "~/Content/themes/base/jquery.ui.slider.css",
                        "~/Content/themes/base/jquery.ui.tabs.css",
                        "~/Content/themes/base/jquery.ui.datepicker.css",
                        "~/Content/themes/base/jquery.ui.progressbar.css",
                        "~/Content/themes/base/jquery.ui.theme.css"));

#if DEBUG

            BundleTable.EnableOptimizations = false;

#else

            BundleTable.EnableOptimizations = true;

#endif
        }

        /// <summary>Gets the kendo css file names</summary>
        public static string[] CssKendoFileNames
        {
            get
            {
                return new[]
                        {                           
                            // Required
                            "~/Content/kendo/kendo.common.min.css",
                            "~/Content/kendo/kendo.default.min.css",
                            // Which "theme" to use
                            "~/Content/kendo/kendo.bootstrap.min.css",
                            "~/Content/kendo/kendo.bootstrap.mobile.min.css",
                        };
            }
        }

        /// <summary>Gets the js file names.</summary>
        public static string[] JsFileNames
        {
            get
            {
                return new[]
                           {
                             "~/Scripts/jquery-{version}.js",
                             "~/Scripts/jquery-ui-{version}.js",
                             "~/Scripts/jquery.unobtrusive*",
                             "~/Scripts/jquery.validate*",
                             "~/Scripts/jszip.min.js",
                             "~/scripts/toastr.js"
                           };
            }
        }

        /// <summary>Gets the angular js file names.</summary>
        public static string[] AngularJsFileNames
        {
            get
            {
                return new[]
                           {
                               "~/Scripts/angular.js",
                               "~/Scripts/angular-resource.js",
                               "~/Scripts/angular-route.js",
                               "~/Scripts/angular-ui/ui-bootstrap.js",
                               "~/Scripts/angular-ui/ui-bootstrap-tpls.js",
                               "~/Scripts/angular.treeview.js",
                               "~/Scripts/kendo/kendo.all.min.js",
                               "~/Scripts/Sortable.js",
                               "~/Scripts/ng-sortable.js",
                               "~/Scripts/jquery.blockUI.js",
                               "~/Scripts/spin.js"
                           };
            }
        }

        public static string[] BootstrapJsFileNames
        {
            get
            {
                return new[]
                            {
                                "~/Scripts/bootstrap.js",
                            };
            }
        }

        public static string[] MainJsFiles
        {
            get
            {
                var result = new List<string>();

                // base requirements
                result.AddRange(
                    new[]
                        {
                            "~/App/main/clConnect.modules.js",
                            "~/App/main/clConnect.app.js",
                            "~/App/main/clConnect.app.routes.js",
                            "~/App/AppConfigure.js",
                            "~/App/main/clConnect.app.run.js"
                        });

                // directives
                result.Add("~/App/main/directives/*.js");

                // filters
                result.Add("~/App/main/filters/*.js");

                return result.ToArray();
            }
        }

        public static string[] SetupJsFiles
        {
            get
            {
                return new[]
           {
                               // interceptors
                               "~/App/setup/interceptors/*.js",

                               // services
                               "~/App/setup/services/*.js",
                               
                               // directives
                               "~/App/setup/directives/*.js",
                                 
                               // controllers
                               "~/App/setup/controllers/*.js"
                           };
            }
        }
    }
}