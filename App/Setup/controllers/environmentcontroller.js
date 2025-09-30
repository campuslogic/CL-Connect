(function () {
    'use strict';

    angular.module('clConnectControllers')
    .controller('environmentcontroller', environmentcontroller);

    environmentcontroller.$inject = ['$scope', 'setupservice', 'validationservice', 'eventpropertyservice', 'configurations', 'pageValidations'];

    function environmentcontroller($scope, setupservice, validationservice, eventpropertyservice, configurations, pageValidations) {
        $scope.service = setupservice;
        $scope.validationService = validationservice;
        $scope.setDocumentSettings = setDocumentSettings;
        $scope.environmentDropDownChangeEvent = environmentDropDownChangeEvent;
        $scope.addRemovePageFromValidation = addRemovePageFromValidation;
        $scope.disableAutoUpdate = false;
        $scope.environments = [
            { text: "Sandbox", value: "sandbox" },
            { text: "Production", value: "production" },
            { text: "Production (Canada)", value: "production-ca"}
        ];

        if (!$scope.service.configurationModel) {
            $scope.service.configurationModel = configurations;
            //temp workaround for deserialization issue              
            setupservice.configurationModel.campusLogicSection.eventNotificationsList = setupservice.configurationModel.campusLogicSection.eventNotifications;
            setupservice.configurationModel.campusLogicSection.fileStoreSettings.fileStoreMappingCollection = setupservice.configurationModel.campusLogicSection.fileStoreSettings.fileStoreMappingCollectionConfig;
            setupservice.configurationModel.campusLogicSection.documentSettings.fieldMappingCollection = setupservice.configurationModel.campusLogicSection.documentSettings.fieldMappingCollectionConfig;
        }

        setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun = angular.isArray(setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun) ? setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun : setupservice.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun.split(',');
        setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun = angular.isArray(setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun) ? setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun : setupservice.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun.split(',');
        setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun = angular.isArray(setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun) ? setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun : setupservice.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun.split(',');
        setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun = angular.isArray(setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun) ? setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun : setupservice.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun.split(',');
        setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun = angular.isArray(setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun) ? setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun : setupservice.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun.split(',');

        if (!$scope.validationService.pageValidations) {
            $scope.validationService.pageValidations = pageValidations;
        }

        if ($scope.service.configurationModel.appSettingsSection.disableAutoUpdate) {
            $scope.disableAutoUpdate = $scope.service.configurationModel.appSettingsSection.disableAutoUpdate;
            if ($scope.disableAutoUpdate) {
                let environment = $scope.service.configurationModel.appSettingsSection.environment;
                $scope.environments.push({ text: environment, value: environment })
            }
        }

        // create DropDownList from select HTML element
        $("#smtp").kendoCheckBox();
        $("#isirUpload").kendoCheckBox();
        $("#bulkActions").kendoCheckBox();
        $("#awardLetterUpload").kendoCheckBox();
        $("#fileMappingUpload").kendoCheckBox();
        $("#dataFileUpload").kendoCheckBox();
        $("#documentImports").kendoCheckBox();
        $("#isirBatchCorrections").kendoCheckBox();
        $("#eventNotifications").kendoCheckBox();
        $("#documentImaging").kendoCheckBox();
        $("#storedProcedure").kendoCheckBox();
        $("#fileStore").kendoCheckBox();
        $("#awardLetterPrint").kendoCheckBox();
        $("#batchProcessing").kendoCheckBox();
        $("#apiIntegration").kendoCheckBox();
        $("#fileDefinitions").kendoCheckBox();
        $("#powerFaids").kendoCheckBox();

        // update event properties each time the setup wizard loads 
        // (starts on environment page)
        eventpropertyservice.updateEventProperties.save({},
            function() {
                eventpropertyservice.getEventPropertyDisplayNames.query({},
                    function(data) {
                        setupservice.configurationModel.campusLogicSection
                            .eventPropertyValueAvailableProperties = data;
                    });
            });

        function setDocumentSettings() {
            if (!$scope.service.configurationModel.campusLogicSection.eventNotifications.eventNotificationsEnabled) {
                $scope.service.configurationModel.campusLogicSection.documentSettings.documentsEnabled = false;
                $scope.service.configurationModel.campusLogicSection.storedProceduresEnabled = false;
                $scope.service.configurationModel.campusLogicSection.fileStoreSettings.fileStoreEnabled = false;
                $scope.service.configurationModel.campusLogicSection.awardLetterPrintSettings.awardLetterPrintEnabled = false;
                $scope.service.configurationModel.campusLogicSection.batchProcessingEnabled = false;
                $scope.service.configurationModel.campusLogicSection.apiIntegrationsEnabled = false;
                $scope.service.configurationModel.campusLogicSection.fileDefinitionsEnabled = false;
                $scope.service.configurationModel.campusLogicSection.powerFaidsEnabled = false;
            }
        }

        function environmentDropDownChangeEvent(e) {
            if (e.sender.value() === '') {
                $scope.validationService.pageValidations.environmentValid = false;
            } else {
                $scope.validationService.pageValidations.environmentValid = true;
            }

        }

        function addRemovePageFromValidation(add, pageName) {
            if (add) {
                $scope.validationService.addPageValidation(pageName);
            } else {
                $scope.validationService.removePageValidation(pageName);
            }
        }
    }
})();