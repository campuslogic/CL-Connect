'use strict';

angular.module('clConnectApp')
    .config([
        "$routeProvider", "$provide", "$httpProvider", "$locationProvider", function ($routeProvider, $provide, $httpProvider, $locationProvider) {

            // This block of code fixes an issue with IE caching 
            // See http://stackoverflow.com/a/19771501 for more information.
            //--------------------------------------------------

            // get requests on templates.
            if (!$httpProvider.defaults.headers.get) {
                $httpProvider.defaults.headers.get = {};
            }

            //disable IE ajax request caching
            $httpProvider.defaults.headers.get['If-Modified-Since'] = 'Mon, 26 Jul 1997 05:00:00 GMT';
            // extra
            $httpProvider.defaults.headers.get['Cache-Control'] = 'no-cache';
            $httpProvider.defaults.headers.get['Pragma'] = 'no-cache';

            //--------------------------------------------------

            var urlRoot = '';
            urlRoot = $("base").first().attr("href");

            
            //Register routes
            $routeProvider
                .when("/", {
                    templateUrl: urlRoot + "/home/menu"
                })
                .when(urlRoot, {
                    templateUrl: "/home/menu"
                })
                .when("/appSettings", {
                    controller: "appsettingscontroller",
                    controllerAs: "vm",
                    templateUrl: urlRoot + "/setup/applicationsettings"
                })
                .when("/credentials", {
                    templateUrl: urlRoot + "/setup/credentials",
                    controller: "credentialscontroller",
                    controllerAs: "vm"
                })
                .when("/environment", {
                    templateUrl: urlRoot + "/setup/environment",
                    controller: "environmentcontroller",
                    resolve: {
                        configurations: ["setupservice", function (setupservice) {
                            if (!setupservice.configurationModel) {
                                return setupservice.configurations.get().$promise;
                            }
                        }],
                        pageValidations: ["validationservice", function (validationservice) {
                            if (!validationservice.pageValidations) {
                                return validationservice.getPageValidationValues.get().$promise;
                            }
                        }]
                    }
                })
                .when("/eventnotifications", {
                    controller: "eventnotificationscontroller",
                    controllerAs: "vm",
                    resolve: {
                        resolveEventNotificationTypes: resolveEventNotificationTypes,
                        resolveEventNotifications: resolveEventNotifications,
                    },
                    templateUrl: urlRoot + "/setup/eventNotifications"
                })
                .when("/saveConfigurations", {
                    templateUrl: urlRoot + "/setup/saveConfigurations"
                })
		        .when("/smtp", {
		            templateUrl: urlRoot + "/setup/smtp",
		            controller: "smtpcontroller"
		        })
                .when("/isirUpload", {
                    templateUrl: urlRoot + "/setup/isirupload",
                    controller: "isiruploadcontroller",
                    controllerAs: "vm"
                })
                .when("/awardLetterUpload", {
                    templateUrl: urlRoot + "/setup/awardletterupload",
                    controller: "awardletteruploadcontroller",
                    controllerAs: "vm"
                })
                .when("/awardLetterFileMappingUpload", {
                    templateUrl: urlRoot + "/setup/awardletterfilemappingupload",
                    controller: "filemappinguploadcontroller",
                    controllerAs: "vm"
                })
                .when("/dataFileUpload", {
                    templateUrl: urlRoot + "/setup/datafileupload",
                    controller: "datafileuploadcontroller",
                    controllerAs: "vm"
                })
                .when("/documentImports", {
                    templateUrl: urlRoot + "/setup/documentimports",
                    controller: "documentimportscontroller",
                    controllerAs: "vm"
                })
		        .when("/isircorrections", {
		            templateUrl: urlRoot + "/setup/isircorrection",
		            controller: "isircorrectioncontroller",
		            controllerAs: "vm"
		        })
                .when("/storedprocedure", {
                    templateUrl: urlRoot + "/setup/storedprocedure",
                    controller: "storedprocedurecontroller"
                })
                .when("/filestore", {
                    templateUrl: urlRoot + "/setup/filestore",
                    controller: "fileStoreController",
                    controllerAs: "vm"
                })
                .when("/awardLetterPrint", {
                    templateUrl: urlRoot + "/setup/awardLetterPrint",
                    controller: "awardLetterPrintController",
                    controllerAs: "vm"
                })
                .when("/document", {
                    templateUrl: urlRoot + "/setup/document",
                    controller: "documentcontroller",
                    controllerAs: "vm"
                })
                .when("/batchprocessing", {
                    templateUrl: urlRoot + "/setup/batchprocessing",
                    controller: "batchProcessingController",
                    controllerAs: "vm"
                })
                .when("/apiintegration", {
                    templateUrl: urlRoot + "/setup/apiintegration",
                    controller: "apiIntegrationController",
                    controllerAs: "vm"
                })
                .when("/bulkAction", {
                    templateUrl: urlRoot + "/setup/bulkaction",
                    controller: "bulkActionController",
                    controllerAs: "vm"
                })
                .when("/filedefinitions", {
                    templateUrl: urlRoot + "/setup/filedefinitions",
                    controller: "fileDefinitionsController",
                    controllerAs: "vm"
                })
                .when("/powerfaids", {
                    templateUrl: urlRoot + "/setup/powerfaids",
                    controller: "powerFaidsController",
                    controllerAs: "vm"
                })
                .otherwise({ redirectTo: "" });

            $provide.decorator("$location", ["$delegate", function ($delegate) {

                //Store original function
                var pathFunc = $delegate.path;
                //Clear query strings
                $delegate.path = function (value) {

                    if (value !== undefined) {
                        $delegate.search({});
                    }

                    var returnVal = pathFunc.call($delegate, value);
                    return returnVal;

                };

                //Done
                return $delegate;

            }]);

        }
    ]);

resolveEventNotificationTypes.$inject = ['validationservice'];
function resolveEventNotificationTypes(validationservice) {
    return validationservice.eventNotificationTypes.query().$promise;
};
resolveEventNotifications.$inject = ['validationservice'];
function resolveEventNotifications(validationservice) {
    return validationservice.eventNotifications.query().$promise;
};