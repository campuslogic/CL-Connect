(function () {
    'use strict';

    angular
        .module('clConnectServices')
        .factory('validationservice', validationservice);

    validationservice.$inject = ['$q', '$resource', 'setupservice', 'eventpropertyservice', '$rootScope'];

    function validationservice($q, $resource, setupservice, eventpropertyservice, $rootScope) {
        var service = {
            eventNotificationTypes: $resource('api/eventNotifications/EventNotificationTypes'),
            eventNotifications: $resource('api/eventNotifications/EventNotifications'),
            testApiCredentials: $resource('api/Credentials/TestAPICredentials/', { username: "@username", password: "@password", environment: "@environment" }),
            testConnectionString: $resource('api/EventNotifications/TestConnectionString'),
            testReadWritePermissions: $resource('api/FolderPicker/TestWritePermissions/', { directoryPath: "@directoryPath" }),
            testSMTP: $resource('api/SMTP/TestSMTP/', { configurationModel: "@configurationModel" }),
            validateAllConfigurations: $resource('api/Setup/ValidateConfigurations:configurationModel'),
            getPageValidationValues: $resource('api/Setup/GetInitialConfigurationValidationModel'),
            pageValidations: null,
            invalidPages: invalidPages,
            removePageValidation: removePageValidation,
            addPageValidation: addPageValidation,
            validateStep: validateStep,
            validateAllSteps: validateAllSteps,
            testEventNotifications: testEventNotifications,
            testCredentials: testCredentials,
            testEnvironment: testEnvironment,
            testBulkActionSettings: testBulkActionSettings,
            testSMTPSettings: testSmtpSettings,
            testAppSettings: testAppSettings,
            testIsirUploadPath: testIsirUpload,
            testIsirCorrections: testIsirCorrections,
            testStoredProcedure: testStoredProcedure,
            testFileStoreSettings: testFileStoreSettings,
            testAwardLetterPrintSettings: testAwardLetterPrintSettings,
            testAwardLetterUploadPath: testAwardLetterUpload,
            testDataFileUploadPath: testDataFileUpload,
            testFileMappingUploadPath: testFileMappingUpload,
            testDocumentSettings: testDocumentSettings,
            testDocumentImports: testDocumentImports,
            testBatchProcessingSettings: testBatchProcessingSettings,
            testApiIntegrations: testApiIntegrations,
            testFileDefinitions: testFileDefinitions,
            testPowerFaids: testPowerFaids,
            folderPathUnique: folderPathUnique,
            testFolderPath: testFolderPath,
            checkForDuplicateEvent: checkForDuplicateEvent,
            checkForInvalidBatchName: checkForInvalidBatchName,
            hasInvalidApiEndpointName: hasInvalidApiEndpointName,
            checkForMissingBatchName: checkForMissingBatchName,
            hasMissingApiEndpointName: hasMissingApiEndpointName,
            hasImproperFileDefinitions: hasImproperFileDefinitions
        };

        function fileDefinitionExistsForName(name, fileDefinitions) {
            for (var i = 0; i < fileDefinitions.length; i++) {
                if (fileDefinitions[i].name === name) {
                    return true;
                }
            }

            return false;
        }

        /**
         * Checks for File Definitions that have been defined for a File Store, Batch, Document
         * and ensures all processes have a defined and unique File Definition name.
         */
        function hasImproperFileDefinitions() {
            var campusLogicSection = setupservice.configurationModel.campusLogicSection;
            var fileDefinitions = campusLogicSection.fileDefinitionsList;

            var fileStoreSettings = campusLogicSection.fileStoreSettings;
            if (fileStoreSettings.fileStoreEnabled) {
                if (!fileDefinitionExistsForName(fileStoreSettings.fileDefinitionName, fileDefinitions)) {
                    // Need to set to false to disable save button
                    service.pageValidations.fileDefinitionSettingsValid = false;
                    return true;
                }
            }

            var documentSettings = campusLogicSection.documentSettings;
            if (documentSettings.documentsEnabled) {
                if (documentSettings.indexFileEnabled) {
                    if (!fileDefinitionExistsForName(documentSettings.fileDefinitionName, fileDefinitions)) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                        return true;
                    }
                }
            }

            if (campusLogicSection.batchProcessingEnabled) {
                var batchProcessingTypesList = campusLogicSection.batchProcessingTypesList;

                for (var i = 0; i < batchProcessingTypesList.length; i++) {
                    var batchProcessingType = batchProcessingTypesList[i];
                    if (batchProcessingType.typeName === 'awardLetterPrint') {
                        var batchProcesses = batchProcessingType.batchProcesses;

                        for (var j = 0; j < batchProcesses.length; j++) {
                            var batchProcess = batchProcesses[j];
                            if (batchProcess.indexFileEnabled) {
                                if (!fileDefinitionExistsForName(batchProcess.fileDefinitionName, fileDefinitions)) {
                                    service.pageValidations.fileDefinitionSettingsValid = false;
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            return false;
        }

        function hasMissingApiEndpointName(currentStep) {
            var eventNotificationsList = setupservice.configurationModel.campusLogicSection.eventNotificationsList;
            var apiEndpointsList = setupservice.configurationModel.campusLogicSection.apiEndpointsList;

            var eventNotificationApiEndpointNames = [];
            var apiEndpointNames = [];

            for (var i = 0; i < eventNotificationsList.length; i++) {
                var apiEndpointName = eventNotificationsList[i].apiEndpointName;
                if (apiEndpointName) {
                    eventNotificationApiEndpointNames.push(apiEndpointName);
                }
            }

            for (var i = 0; i < apiEndpointsList.length; i++) {
                if (apiEndpointsList[i].name) {
                    apiEndpointNames.push(apiEndpointsList[i].name);
                }
            }

            // Is API Integrations missing an endpoint?
            for (var i = 0; i < eventNotificationApiEndpointNames.length; i++) {
                if (apiEndpointNames.indexOf(eventNotificationApiEndpointNames[i]) == -1) {
                    service.pageValidations.apiIntegrationsValid = false;
                    return true;
                }
            }

            return false;
        }

        function checkForMissingBatchName(currentStep) {
            var eventNotificationsList = setupservice.configurationModel.campusLogicSection.eventNotificationsList;
            var batchProcessingTypesList = setupservice.configurationModel.campusLogicSection.batchProcessingTypesList;

            var eventHandlerBatchNames = [];
            var batchProcessNames = [];

            for (var i = 0; i < eventNotificationsList.length; i++) {
                eventHandlerBatchNames.push(eventNotificationsList[i].batchName);
            }

            for (var i = 0; i < batchProcessingTypesList.length; i++) {
                var batchProcesses = batchProcessingTypesList[i].batchProcesses;
                for (var j = 0; j < batchProcesses.length; j++) {
                    batchProcessNames.push(batchProcesses[j].batchName);
                }
            }

            // Is the batch process page missing a batch?
            for (var i = 0; i < eventHandlerBatchNames.length; i++) {
                if (checkForEmptyOrNullString(eventHandlerBatchNames[i]) && batchProcessNames.indexOf(eventHandlerBatchNames[i]) == -1) {
                    service.pageValidations.batchProcessingSettingsValid = false;
                    return true;
                }
            }

            return false;
        }

        function checkForInvalidBatchName() {
            var eventNotificationsList = setupservice.configurationModel.campusLogicSection.eventNotificationsList;

            // Check for blank batch name
            for (var i = 0; i < eventNotificationsList.length; i++) {
                if (eventNotificationsList[i].handleMethod == "BatchProcessingAwardLetterPrint" && (!eventNotificationsList[i].batchName || !eventNotificationsList[i].batchName.length)) {
                    return true;
                }
            }

            // Check for duplicate batch name within a type
            if (eventNotificationsList.length > 1) {
                for (var i = 0; i < eventNotificationsList.length; i++) {
                    if (eventNotificationsList[i].handleMethod == "BatchProcessingAwardLetterPrint") {
                        if (i < eventNotificationsList.length - 1) {
                            for (var j = i + 1; j < eventNotificationsList.length; j++) {
                                if (eventNotificationsList[j].handleMethod == "BatchProcessingAwardLetterPrint" && eventNotificationsList[j].batchName == eventNotificationsList[i].batchName) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }

            return false;
        }

        function hasInvalidApiEndpointName() {
            var eventNotificationsList = setupservice.configurationModel.campusLogicSection.eventNotificationsList;

            // Check for blank API Endpoint Name
            for (var i = 0; i < eventNotificationsList.length; i++) {
                if (eventNotificationsList[i].handleMethod == "ApiIntegration" && (!eventNotificationsList[i].apiEndpointName || !eventNotificationsList[i].apiEndpointName.length)) {
                    return true;
                }
            }

            return false;
        }

        function checkForDuplicateEvent() {
            var sorted, i;
            var duplicate; if (setupservice.configurationModel.campusLogicSection.eventNotificationsList.length > 1) {

                sorted = setupservice.configurationModel.campusLogicSection.eventNotificationsList.concat().sort(function (a, b) {
                    if (a.eventNotificationId > b.eventNotificationId) return 1;
                    if (a.eventNotificationId < b.eventNotificationId) return -1;
                    return 0;
                });

                for (i = 0; i < setupservice.configurationModel.campusLogicSection.eventNotificationsList.length; i++) {

                    duplicate = ((sorted[i - 1] && sorted[i - 1].eventNotificationId == sorted[i].eventNotificationId) || (sorted[i + 1] && sorted[i + 1].eventNotificationId == sorted[i].eventNotificationId));
                    if (duplicate) {
                        return true;
                    }
                }
                return false;
            } else {
                return false;
            }
        }

        function folderPathUnique(uploadpath) {
            var filePathValues = [];
            if (setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadFilePath);
                filePathValues.push(setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirArchiveFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterArchiveFilePath);
                filePathValues.push(setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingArchiveFilePath);
                filePathValues.push(setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileArchiveFilePath);
                filePathValues.push(setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsFilePath);

                if (setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientEnabled) {
                    filePathValues.push(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientArchiveFilePath);
                }
            }

            if (setupservice.configurationModel.campusLogicSection.documentSettings.documentsEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.documentSettings.documentStorageFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.fileStoreSettings.fileStoreEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.fileStoreSettings.fileStorePath);
            }

            if (setupservice.configurationModel.campusLogicSection.awardLetterPrintSettings.awardLetterPrintEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.awardLetterPrintSettings.awardLetterPrintFilePath);
            }

            if (setupservice.configurationModel.campusLogicSection.documentImportSettings.enabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.documentImportSettings.fileDirectory);
                filePathValues.push(setupservice.configurationModel.campusLogicSection.documentImportSettings.archiveDirectory);
            }

            if (setupservice.configurationModel.campusLogicSection.batchProcessingEnabled) {
                var batchProcessingTypesList = setupservice.configurationModel.campusLogicSection.batchProcessingTypesList;
                var batchFilePaths = [];

                for (var i = 0; i < batchProcessingTypesList.length; i++) {
                    var batchProcessingType = batchProcessingTypesList[i];
                    for (var j = 0; j < batchProcessingType.batchProcesses.length; j++) {
                        var batchProcess = batchProcessingType.batchProcesses[j];
                        if (batchFilePaths.indexOf(batchProcess.filePath) == -1) {
                            batchFilePaths.push(batchProcess.filePath);
                        }
                    }
                }

                for (var i = 0; i < batchFilePaths.length; i++) {
                    filePathValues.push(batchFilePaths[i]);
                }
            }

            if (setupservice.configurationModel.campusLogicSection.powerFaidsSettings.powerFaidsEnabled) {
                filePathValues.push(setupservice.configurationModel.campusLogicSection.powerFaidsSettings.filePath);
            }

            if (uploadpath) {
                var matches = $.grep(filePathValues, function (filePath) {
                    return filePath && uploadpath.toUpperCase() === filePath.toUpperCase();
                });
                if (matches.length > 1) {
                    return false;
                }
            }
            return true;
        }

        function invalidPages() {
            var ret = $.grep(Object.keys(service.pageValidations), function (page) {
                return (service.pageValidations[page] === false
                    && (page !== 'issmtpTested'
                        && page !== 'apiCredentialsTested'
                        && page !== 'eventNotificationsConnectionTested'
                        && page !== 'duplicatePath'
                        && page !== 'duplicateEvent'
                        && page !== 'invalidBatchName'
                        && page !== 'missingBatchName'
                        && page !== 'invalidApiEndpointName'
                        && page !== 'missingApiEndpointName'
                        && page !== 'improperFileDefinitions'));
            });
            return ret;
        }

        function removePageValidation(pageValid) {
            if (pageValid === 'eventNotificationsValid') {
                delete (service.pageValidations[pageValid]);
                delete (service.pageValidations["documentSettingsValid"]);
                delete (service.pageValidations["fileStoreSettingsValid"]);
                delete (service.pageValidations["awardLetterPrintSettingsValid"]);
                delete (service.pageValidations["storedProcedureValid"]);
                delete (service.pageValidations["connectionStringValid"]);
            } else {
                delete (service.pageValidations[pageValid]);
            }
        }

        function addPageValidation(pageValid) {
            service.pageValidations[pageValid] = true;

            if (pageValid === 'eventNotificationsValid') {
                service.pageValidations['connectionStringValid'] = true;
            }
        }

        function validateStep(currentStep, form) {
            switch (currentStep) {
                case '/appSettings':
                    service.testAppSettings(form);
                    break;
                case '/credentials':
                    service.testCredentials(form);
                    break;
                case '/environment':
                    service.testEnvironment(form);
                    break;
                case '/eventnotifications':
                    service.testEventNotifications(form);
                    break;
                case '/smtp':
                    service.testSMTPSettings(form);
                    break;
                case '/isirUpload':
                    service.testIsirUploadPath();
                    break;
                case '/awardLetterUpload':
                    service.testAwardLetterUploadPath();
                    break;
                case '/dataFileUpload':
                    service.testDataFileUploadPath();
                    break;
                case '/isircorrections':
                    service.testIsirCorrections();
                    break;
                case '/storedprocedure':
                    service.testStoredProcedure(form);
                    break;
                case '/document':
                    service.testDocumentSettings(form);
                    break;
                case '/documentImports':
                    service.testDocumentImports();
                    break;
                case '/filestore':
                    service.testFileStoreSettings(form);
                    break;
                case '/awardLetterPrint':
                    service.testAwardLetterPrintSettings(form);
                    break;
                case '/batchprocessing':
                    service.testBatchProcessingSettings(form);
                    break;
                case '/apiintegration':
                    service.testApiIntegrations(form);
                    break;
                case '/bulkAction':
                    service.testBulkActionSettings();
                    break;
                case '/filedefinitions':
                    service.testFileDefinitions();
                    break;
                case '/powerfaids':
                    service.testPowerFaids();
                    break;
                default:
                    return;
            }
        }

        function validateAllSteps(form) {
            service.testEnvironment();
            service.testCredentials();
            service.testAppSettings();
            if (setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadEnabled) {
                service.testIsirUploadPath();
            }
            if (setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadEnabled) {
                service.testAwardLetterUploadPath();
            }
            if (setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadEnabled) {
                service.testDataFileUploadPath();
            }
            if (setupservice.configurationModel.campusLogicSection.smtpSettings.notificationsEnabled) {
                service.testSMTPSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.bulkActionSettings.bulkActionEnabled) {
                service.testBulkActionSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.eventNotificationsEnabled) {
                service.testEventNotifications();
            }
            if (setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsEnabled) {
                service.testIsirCorrections();
            }
            if (setupservice.configurationModel.campusLogicSection.storedProceduresEnabled) {
                service.testStoredProcedure();
            }
            if (setupservice.configurationModel.campusLogicSection.documentSettings.documentsEnabled) {
                service.testDocumentSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.documentImportSettings.enabled) {
                service.testDocumentImports();
            }
            if (setupservice.configurationModel.campusLogicSection.fileStoreSettings.fileStoreEnabled) {
                service.testFileStoreSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.awardLetterPrintSettings.awardLetterPrintEnabled) {
                service.testAwardLetterPrintSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.batchProcessingEnabled) {
                service.testBatchProcessingSettings();
            }
            if (setupservice.configurationModel.campusLogicSection.apiIntegrationsEnabled) {
                service.testApiIntegrations();
            }
            if (setupservice.configurationModel.campusLogicSection.fileDefinitionsEnabled) {
                service.testFileDefinitions();
            }
            if (setupservice.configurationModel.campusLogicSection.powerFaidsEnabled) {
                service.testPowerFaids();
            }
        }

        function testStoredProcedure() {
            if (setupservice.configurationModel.campusLogicSection.storedProcedureList.length === 0) {
                service.pageValidations.storedProcedureValid = false;
            } else {
                service.pageValidations.storedProcedureValid = true;
            }
        }

        function testAppSettings(form) {
            service.pageValidations.applicationSettingsValid = form ? form.$valid : manuallyTestAppSettings();
        }

        function testFolderPath(folderPath) {
            if (folderPath !== '' && folderPath && service.folderPathUnique(folderPath)) {
                return true;
            }
            else {
                return false;
            }
        }

        function testIsirUpload() {
            if (setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun.length > 0
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadFilePath)
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirArchiveFilePath)) {

                service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadFilePath }, function (response) {
                    service.pageValidations.isirUploadValid = true;
                }, function (error) {
                    service.pageValidations.isirUploadValid = false;
                });


                if (service.pageValidations.isirUploadValid) {
                    service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirArchiveFilePath }
                        , function (response) {
                            service.pageValidations.isirUploadValid = true;
                        }, function (error) {
                            service.pageValidations.isirUploadValid = false;
                        });
                }
            }
            else {
                service.pageValidations.isirUploadValid = false;
            }
        }

        function testAwardLetterUpload() {
            if (setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun.length > 0
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadFilePath)
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterArchiveFilePath)) {

                service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadFilePath }
                    , function (response) {
                        service.pageValidations.awardLetterUploadValid = true;
                    }, function (error) {
                        service.pageValidations.awardLetterUploadValid = false;
                    });

                if (service.pageValidations.awardLetterUploadValid) {
                    service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterArchiveFilePath }
                        , function (response) {
                            service.pageValidations.awardLetterUploadValid = true;
                        }, function (error) {
                            service.pageValidations.awardLetterUploadValid = false;
                        });
                }
            }
            else {
                service.pageValidations.awardLetterUploadValid = false;
            }
        }

        function testDataFileUpload() {
            if (setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun.length > 0
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadFilePath)
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileArchiveFilePath)) {

                service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadFilePath }
                    , function (response) {
                        service.pageValidations.dataFileUploadValid = true;
                    }, function (error) {
                        service.pageValidations.dataFileUploadValid = false;
                    });

                if (service.pageValidations.dataFileUploadValid) {
                    service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileArchiveFilePath }
                        , function (response) {
                            service.pageValidations.dataFileUploadValid = true;
                        }, function (error) {
                            service.pageValidations.dataFileUploadValid = false;
                        });
                }
            }
            else {
                service.pageValidations.dataFileUploadValid = false;
            }
        }

        function testFileMappingUpload() {
            if (setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun.length > 0
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadFilePath)
                && service.testFolderPath(setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingArchiveFilePath)) {

                service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadFilePath }
                    , function (response) {
                        service.pageValidations.fileMappingUploadValid = true;
                    }, function (error) {
                        service.pageValidations.fileMappingUploadValid = false;
                    });

                if (service.pageValidations.fileMappingUploadValid) {
                    service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingArchiveFilePath }
                        , function (response) {
                            service.pageValidations.fileMappingUploadValid = true;
                        }, function (error) {
                            service.pageValidations.fileMappingUploadValid = false;
                        });
                }
            }
            else {
                service.pageValidations.fileMappingUploadValid = false;
            }
        }

        function testIsirCorrections() {
            service.pageValidations.isirCorrectionsValid = true;

            if ($rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsFilePath) === false
                && $rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.timeToRun) === false
                && setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun.length > 0) {
                service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsFilePath }
                    , function (response) {
                        //service.pageValidations.isirCorrectionsValid = true;
                    }, function (error) {
                        service.pageValidations.isirCorrectionsValid = false;
                    });
            }
            else {
                service.pageValidations.isirCorrectionsValid = false;
            }

            if (setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientEnabled === true) {
                if ($rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientExecutablePath) === false
                    && $rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientArchiveFilePath) === false
                    && $rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientSecfileFolderPath) === false
                    && $rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientFtpUserId) === false
                    && $rootScope.isNullOrWhitespace(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientFtpUsername) === false
                    && setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientArchiveFilePath !== setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.correctionsFilePath) {
                    service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientExecutablePath }, function (response) {
                        service.testReadWritePermissions.get({ directoryPath: setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.tdClientArchiveFilePath }, function (response) {
                        }, function (error) { service.pageValidations.isirCorrectionsValid = false; });
                    }, function (error) { service.pageValidations.isirCorrectionsValid = false; });
                }
                else {
                    service.pageValidations.isirCorrectionsValid = false;
                }
            }
        }

        function manuallyTestAppSettings() {
            return (setupservice.configurationModel.appSettingsSection.backgroundWorkerCount !== ''
                && setupservice.configurationModel.appSettingsSection.backgroundWorkerRetryAttempts !== ''
                && setupservice.configurationModel.appSettingsSection.purgeReceivedEventsAfterDays !== ''
                && setupservice.configurationModel.appSettingsSection.purgeLogRecordsAfterDays !== ''
                && setupservice.configurationModel.appSettingsSection.purgeNotificationLogRecordsAfterDays !== ''
                && setupservice.configurationModel.appSettingsSection.incomingApiUsername !== ''
                && setupservice.configurationModel.appSettingsSection.incomingApiPassword !== '');
        }

        function testEventNotifications(form) {
            service.pageValidations.eventNotificationsConnectionTested = false;
            if (!service.checkForDuplicateEvent() && !service.checkForInvalidBatchName() && !service.hasInvalidApiEndpointName()) {
                service.pageValidations.eventNotificationsValid = form ? form.$valid : service.pageValidations.eventNotificationsValid;
                service.pageValidations.connectionStringValid = true;
                if ((!form && !service.pageValidations.eventNotificationsConnectionTested) || form.$valid) {
                    service.pageValidations.eventNotificationsConnectionTested = false;
                    if (setupservice.configurationModel.campusLogicSection.clientDatabaseConnection.connectionString && setupservice.configurationModel.campusLogicSection.clientDatabaseConnection.connectionString.length > 0) {
                        service.testConnectionString.get(
                            {
                                connectionString: setupservice.configurationModel.campusLogicSection.clientDatabaseConnection.connectionString
                            },
                            function () {
                                service.pageValidations.connectionStringValid = true;
                                service.pageValidations.eventNotificationsConnectionTested = true;
                            },
                            function () {
                                service.pageValidations.eventNotificationsConnectionTested = true;
                                service.pageValidations.connectionStringValid = false;
                            });
                    }
                }
            } else {
                service.pageValidations.eventNotificationsValid = false;
            }
        }

        function testCredentials(form) {
            try {
                service.pageValidations.apiCredentialsValid = form ? form.$valid : true;
                if (!form || form.$valid) {
                    service.pageValidations.apiCredentialsTested = false;
                    service.testApiCredentials
                        .get(
                            {
                                username: setupservice.configurationModel.appSettingsSection.apiUsername,
                                password: setupservice.configurationModel.appSettingsSection.apiPassword,
                                environment: setupservice.configurationModel.appSettingsSection.environment,
                                awardLetterUploadEnabled: setupservice.configurationModel.campusLogicSection
                                    .awardLetterUploadSettings.awardLetterUploadEnabled
                            },
                            function () {
                                service.pageValidations.apiCredentialsTested = true;
                                service.pageValidations.apiCredentialsValid = true;
                                // if credentials are valid, update EventProperties from PM
                                eventpropertyservice.updateEventPropertiesWithCredentials.save(
                                    {
                                        username: setupservice.configurationModel.appSettingsSection.apiUsername,
                                        password: setupservice.configurationModel.appSettingsSection.apiPassword,
                                        environment: setupservice.configurationModel.appSettingsSection.environment
                                    },
                                    function () {
                                        eventpropertyservice.getEventPropertyDisplayNames.query({},
                                            function (data) {
                                                setupservice.configurationModel.campusLogicSection
                                                    .eventPropertyValueAvailableProperties = data;
                                            });
                                    });
                            },
                            function () {
                                service.pageValidations.apiCredentialsTested = true;
                                service.pageValidations.apiCredentialsValid = false;
                            });
                }
            }
            catch (exception) {
                toastr.error("An error occured while attempting to connect to the API.");
            }
        }

        function testEnvironment(form) {
            service.pageValidations.environmentValid = form && form.$dirty ? form.$valid : manuallyTestEnvironment();
        }

        function manuallyTestEnvironment() {
            if (setupservice.configurationModel.appSettingsSection.disableAutoUpdate) {
                return true;
            } else {
                return (setupservice.configurationModel.appSettingsSection.environment === 'sandbox'
                    || setupservice.configurationModel.appSettingsSection.environment === 'production'
                    || setupservice.configurationModel.appSettingsSection.environment === 'production-ca');
            }
        }

        function testSmtpSettings(form) {
            try {
                service.pageValidations.issmtpTested = false;
                service.pageValidations.smtpValid = form ? form.$valid : service.pageValidations.smtpValid;
                if ((!form && !service.pageValidations.issmtpTested) || form.$valid) {
                    service.testSMTP.save({
                        smtpSection: {
                            deliveryMethod: setupservice.configurationModel.smtpSection.deliveryMethod,
                            from: setupservice.configurationModel.smtpSection.from,
                            network: {
                                defaultCredentials: setupservice.configurationModel.smtpSection.network.defaultCredentials,
                                clientDomain: setupservice.configurationModel.smtpSection.network.clientDomain,
                                enableSsl: setupservice.configurationModel.smtpSection.network.enableSsl,
                                host: setupservice.configurationModel.smtpSection.network.host,
                                password: setupservice.configurationModel.smtpSection.network.password,
                                port: setupservice.configurationModel.smtpSection.network.port,
                                targetName: setupservice.configurationModel.smtpSection.network.targetName,
                                userName: setupservice.configurationModel.smtpSection.network.userName
                            },
                            specifiedPickupDirectory: {
                                pickupDirectoryLocation: setupservice.configurationModel.smtpSection.specifiedPickupDirectory.pickupDirectoryLocation
                            }
                        },

                        sendTo: setupservice.configurationModel.campusLogicSection.smtpSettings.sendTo
                    }, function (data) {
                        service.pageValidations.issmtpTested = true;
                        service.pageValidations.smtpValid = true;
                    },
                        function (error) {
                            service.pageValidations.issmtpTested = true;
                            service.pageValidations.smtpValid = false;
                        });
                }
            }
            catch
            (exception) {
                toastr.error("An error occured while attempting to connect to SMTP.");
            }
        }

        function testBulkActionSettings() {
            service.pageValidations.bulkActionSettingsValid = true;
            var settings = setupservice.configurationModel.campusLogicSection.bulkActionSettings;
            service.pageValidations.bulkActionSettingsValid = settings && settings.bulkActionEnabled && !!(settings.bulkActionArchivePath && settings.bulkActionUploadPath && settings.frequency && settings.notificationEmail);
        }

        function testDocumentSettings(form) {
            try {
                service.pageValidations.documentSettingsValid = form ? form.$valid : service.pageValidations.documentSettingsValid;
                if (!form || form.$valid) {

                    service.pageValidations.documentSettingsValid = true;
                    var settings = setupservice.configurationModel.campusLogicSection.documentSettings;
                    if (settings.documentsEnabled === null) {
                        service.pageValidations.documentSettingsValid = false;
                    }
                    else if (settings.indexFileEnabled === undefined || settings.indexFileEnabled === null || settings.indexFileEnabled === "") {
                        service.pageValidations.documentSettingsValid = false;
                    }
                    else if (settings.indexFileEnabled === true) {
                        if (settings.documentStorageFilePath === undefined || settings.documentStorageFilePath === null || settings.documentStorageFilePath === "") {
                            service.pageValidations.documentSettingsValid = false;
                        }
                        if (settings.fileDefinitionName === undefined || settings.fileDefinitionName === null || settings.fileDefinitionName === "") {
                            service.pageValidations.documentSettingsValid = false;
                        }
                        if (service.testFolderPath(settings.documentStorageFilePath)) {

                            service.testReadWritePermissions.get({ directoryPath: settings.documentStorageFilePath }, function (response) { }, function (error) {
                                service.pageValidations.documentSettingsValid = false;
                            });
                        } else {
                            service.pageValidations.documentSettingsValid = false;
                        }
                    }
                }
            }
            catch (exception) {
                toastr.error("An error occured while attempting to validate the Document Settings.");
            }
        }

        function testFileStoreSettings(form) {
            try {
                service.pageValidations.fileStoreSettingsValid = form ? form.$valid : service.pageValidations.fileStoreSettingsValid;
                if (!form || form.$valid) {

                    service.pageValidations.fileStoreSettingsValid = true;
                    var settings = setupservice.configurationModel.campusLogicSection.fileStoreSettings;
                    if (settings.fileStoreEnabled === null) {
                        service.pageValidations.fileStoreSettingsValid = false;
                    }
                    if (settings.fileStorePath === undefined || settings.fileStorePath === null || settings.fileStorePath === "") {
                        service.pageValidations.fileStoreSettingsValid = false;
                    }
                    else if (settings.fileStoreMinutes === undefined || settings.fileStoreMinutes === null || settings.fileStoreMinutes === "") {
                        service.pageValidations.fileStoreSettingsValid = false;
                    }
                    else if (settings.fileDefinitionName === undefined || settings.fileDefinitionName === null || settings.fileDefinitionName === "") {
                        service.pageValidations.fileStoreSettingsValid = false;
                    }
                    if (service.testFolderPath(settings.fileStorePath)) {

                        service.testReadWritePermissions.get({ directoryPath: settings.fileStorePath }, function (response) { }, function (error) {
                            service.pageValidations.fileStoreSettingsValid = false;
                        });
                    } else {
                        service.pageValidations.fileStoreSettingsValid = false;
                    }
                }
            }
            catch (exception) {
                toastr.error("An error occured while attempting to validate the File Store Settings.");
            }
        }

        function testAwardLetterPrintSettings() {
            service.pageValidations.awardLetterPrintSettingsValid = true;
            var settings = setupservice.configurationModel.campusLogicSection.awardLetterPrintSettings;
            if (settings.awardLetterPrintEnabled === null) {
                service.pageValidations.awardLetterPrintSettingsValid = false;
            }
            if (settings.awardLetterPrintFilePath === undefined || settings.awardLetterPrintFilePath === null || settings.awardLetterPrintFilePath === "") {
                service.pageValidations.awardLetterPrintSettingsValid = false;
            }
        }

        function testDocumentImports() {

            var s = setupservice.configurationModel.campusLogicSection.documentImportSettings;

            // Check truthiness of all values.
            service.pageValidations.documentImportsValid = !!(s.enabled && s.frequency && s.fileDirectory && s.archiveDirectory && s.fileExtension);
        }

        function testBatchProcessingSettings(form) {
            var batchProcessingTypesList = setupservice.configurationModel.campusLogicSection.batchProcessingTypesList;

            if (batchProcessingTypesList.length === 0) {
                service.pageValidations.batchProcessingSettingsValid = false;
            } else {
                service.pageValidations.batchProcessingSettingsValid = true;

                var filePaths = [];

                for (var i = 0; i < batchProcessingTypesList.length; i++) {
                    var batchProcesses = batchProcessingTypesList[i].batchProcesses;

                    if (batchProcesses.length > 0) {
                        var filePathsForBatchType = [];

                        for (var j = 0; j < batchProcesses.length; j++) {
                            if (!checkForEmptyOrNullString(batchProcesses[j].filePath)) {
                                service.pageValidations.batchProcessingSettingsValid = false;
                                return;
                            } else {
                                // Get unique file path within type
                                if (filePathsForBatchType.indexOf(batchProcesses[j].filePath == -1)) {
                                    filePathsForBatchType.push(batchProcesses[j].filePath);
                                }
                            }

                            // Add all unique paths to list of all batch file paths
                            for (var k = 0; k < filePathsForBatchType.length; k++) {
                                filePaths.push(filePathsForBatchType[k]);
                            }
                        }
                    } else {
                        service.pageValidations.batchProcessingSettingsValid = false;
                        return;
                    }
                }

                // Test if paths are unique across batch types and other integrations
                for (var i = 0; i < filePaths.length; i++) {
                    if (service.testFolderPath(filePaths[i])) {
                        service.testReadWritePermissions.get({ directoryPath: filePaths[i] }, function (response) {
                        }, function (error) {
                            service.pageValidations.batchProcessingSettingsValid = false;
                            return;
                        });
                    } else {
                        service.pageValidations.batchProcessingSettingsValid = false;
                        return;
                    }
                }
            }
        }

        function getEndpointsForApi(id, endpoints) {
            return $.grep(endpoints, function (endpoint) {
                return endpoint.apiId === id;
            });
        }

        function testApiIntegrations(form) {
            var apiIntegrationsList = setupservice.configurationModel.campusLogicSection.apiIntegrationsList;
            var apiEndpointsList = setupservice.configurationModel.campusLogicSection.apiEndpointsList;

            // Ensure there is at least one API Integration
            if (apiIntegrationsList.length === 0) {
                service.pageValidations.apiIntegrationsValid = false;
            } else {
                service.pageValidations.apiIntegrationsValid = true;

                // Ensure each API Integration has at least one endpoint
                for (var i = 0; i < apiIntegrationsList.length; i++) {
                    var endpoints = getEndpointsForApi(apiIntegrationsList[i].apiId, apiEndpointsList);
                    if (endpoints.length === 0) {
                        service.pageValidations.apiIntegrationsValid = false;
                    }

                    // Ensure parameter mappings are defined for each endpoint
                    for (var j = 0; j < endpoints.length; j++) {
                        if (endpoints[j].parameterMappings === null || endpoints[j].parameterMappings === undefined) {
                            service.pageValidations.apiIntegrationsValid = false;
                        }
                    }
                }
            }
        }

        function testFileDefinitions(form) {
            var fileDefinitionsList = setupservice.configurationModel.campusLogicSection.fileDefinitionsList;

            if (fileDefinitionsList.length === 0) {
                service.pageValidations.fileDefinitionSettingsValid = false;
            } else {
                // Need to set to true to re-enable save button if improperFileDefinition was toggled
                service.pageValidations.fileDefinitionSettingsValid = true;

                // Ensure each File Definition is valid, along with their mapping
                for (var i = 0; i < fileDefinitionsList.length; i++) {
                    var fileDefinition = fileDefinitionsList[i];

                    if (hasEmptyOrNullString(fileDefinition.name)) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }
                    else if (hasEmptyOrNullString(fileDefinition.fileNameFormat)) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }
                    else if (fileDefinition.includeHeaderRecord == null) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }
                    else if (hasEmptyOrNullString(fileDefinition.fileExtension)) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }
                    else if (hasEmptyOrNullString(fileDefinition.fileFormat)) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }
                    else if (fileDefinition.fieldMappingCollection.length == 0) {
                        service.pageValidations.fileDefinitionSettingsValid = false;
                    }

                    //loop through each field mapping
                    for (var i = 0; i < fileDefinition.fieldMappingCollection.length; i++) {
                        var fieldMapping = fileDefinition.fieldMappingCollection[i];
                        if ($rootScope.isNullOrWhitespace(fieldMapping.fieldSize)) {
                            service.pageValidations.fileDefinitionSettingsValid = false;
                        }
                        if ($rootScope.isNullOrWhitespace(fieldMapping.dataType)) {
                            service.pageValidations.fileDefinitionSettingsValid = false;
                        }
                        if ($rootScope.isNullOrWhitespace(fieldMapping.fileFieldName)) {
                            service.pageValidations.fileDefinitionSettingsValid = false;
                        }
                        if (fileDefinition.fileFormat == "xml" && fieldMapping.fileFieldName.indexOf(' ') >= 0) {
                            service.pageValidations.fileDefinitionSettingsValid = false;
                        }
                        if (fileDefinition.indexFileEnabled && (fileDefinition.fileFormat == "csv" || fileDefinition.fileFormat == "csvnoquotes") && fieldMapping.fileFieldName.indexOf(',') >= 0) {
                            service.pageValidations.fileDefinitionSettingsValid = false;
                        }
                    }
                }
            }
        }

        function testPowerFaids(form) {
            service.pageValidations.powerFaidsSettingsValid = true;
            var settings = setupservice.configurationModel.campusLogicSection.powerFaidsSettings;

            if (settings) {
                if (!settings.filePath) {
                    service.pageValidations.powerFaidsSettingsValid = false;
                }

                if (settings.isBatch == null) {
                    service.pageValidations.powerFaidsSettingsValid = false;
                } else {
                    if (settings.isBatch && !settings.batchExecutionMinutes) {
                        service.pageValidations.powerFaidsSettingsValid = false;
                    }
                }

                var powerFaidsList = setupservice.configurationModel.campusLogicSection.powerFaidsList;

                if (powerFaidsList && powerFaidsList.length > 0) {
                    for (var i = 0; i < powerFaidsList.length; i++) {
                        // Check for uniqueness of event/transaction category combinations
                        for (var j = 0; j < powerFaidsList.length; j++) {
                            if (j !== i && powerFaidsList[j].event === powerFaidsList[i].event && powerFaidsList[j].transactionCategory === powerFaidsList[i].transactionCategory) {
                                service.pageValidations.powerFaidsSettingsValid = false;
                            }
                        }

                        // Ensure the event is mapped
                        if (!setupservice.configurationModel.campusLogicSection.eventNotifications.find(function (event) {
                            return event.eventNotificationId == powerFaidsList[i].event;
                        })) {
                            service.pageValidations.powerFaidsSettingsValid = false;
                        }

                        if (powerFaidsList[i].outcome) {
                            if (powerFaidsList[i].outcome === "documents" && (!powerFaidsList[i].shortName || !powerFaidsList[i].requiredFor || !powerFaidsList[i].status || !powerFaidsList[i].documentLock)) {
                                service.pageValidations.powerFaidsSettingsValid = false;
                            } else if (powerFaidsList[i].outcome === "verification" && (!powerFaidsList[i].verificationOutcome || !powerFaidsList[i].verificationOutcomeLock)) {
                                service.pageValidations.powerFaidsSettingsValid = false;
                            } else if (powerFaidsList[i].outcome === "both" && (!powerFaidsList[i].shortName || !powerFaidsList[i].requiredFor || !powerFaidsList[i].status || !powerFaidsList[i].documentLock || !powerFaidsList[i].verificationOutcome || !powerFaidsList[i].verificationOutcomeLock)) {
                                service.pageValidations.powerFaidsSettingsValid = false;
                            }
                        } else {
                            service.pageValidations.powerFaidsSettingsValid = false;
                        }
                    }
                } else {
                    service.pageValidations.powerFaidsSettingsValid = false;
                }
            } else {
                service.pageValidations.powerFaidsSettingsValid = false;
            }
        }

        function checkForEmptyOrNullString(obj) {
            return !(obj === undefined || obj === null || obj === "");
        }

        function hasEmptyOrNullString(obj) {
            return obj === undefined || obj === null || obj === "";
        }

        return service;
    }
})();