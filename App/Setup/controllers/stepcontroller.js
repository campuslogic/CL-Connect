(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('stepcontroller', stepcontroller);

    stepcontroller.$inject = ['$scope', 'setupservice', 'validationservice', '$location'];

    function stepcontroller($scope, setupservice, validationservice, $location) {
        $scope.service = setupservice;
        $scope.validationService = validationservice;
        $scope.getActiveStep = getActiveStep;
        $scope.activeStep = '/environment';
        $scope.goNext = goToNextEnabledStep;
        $scope.saveConfigurations = saveConfigurations;
        $scope.validateStep = validateStep;
        $scope.validateAllSteps = validateAllSteps;
        $scope.concatenateDaysToRun = concatenateDaysToRun;
        $scope.errorCopying = false;
        $scope.success = false;
        $scope.invalidPages = $scope.validationService.invalidPages;
        $scope.checkForInvalidBatchName = $scope.validationService.checkForInvalidBatchName;
        $scope.checkForMissingBatchName = $scope.validationService.checkForMissingBatchName;
        $scope.hasInvalidApiEndpointName = $scope.validationService.hasInvalidApiEndpointName;
        $scope.hasMissingApiEndpointName = $scope.validationService.hasMissingApiEndpointName;
        $scope.hasImproperFileDefinitions = $scope.validationService.hasImproperFileDefinitions;
        $scope.disableSave = false;
        $scope.fail = false;
        $scope.duplicatePath = false;
        $scope.duplicateEvent = false;
        $scope.invalidBatchName = false;
        $scope.missingBatchName = false;
        $scope.missingApiEndpointName = false;
        $scope.improperFileDefinitions = false;

        function getActiveStep(path) {
            $scope.activeStep = $location.path();
            return ($location.path() === path) ? 'active' : '';
        }

        function goToNextEnabledStep() {
            var activeStepListLinks = [];
            var nextStepLink = '';
            $('#stepList a').each(function () {
                activeStepListLinks.push($(this).attr('cl-link-to'));
            });

            for (var i = 0; i < activeStepListLinks.length; i++) {
                if ($location.path() === activeStepListLinks[i]) {
                    nextStepLink = activeStepListLinks[i + 1];
                    break;
                }
            }

            if (nextStepLink === '/saveConfigurations') {
                $scope.disableSave = true;
                $scope.validateAllSteps();
            }
            $location.path(nextStepLink);
        }

        function saveConfigurations() {
            if ($scope.validationService.invalidPages.length === 0 || $scope.disableSave) {
                $scope.disableSave = true;
                $scope.errorCopying = false;
                $scope.success = false;
                $scope.fail = false;

                // Convert from array to concatenated string
                $scope.concatenateDaysToRun();
                
                $scope.validationService.validateAllConfigurations.save($scope.service.configurationModel, function () {
                    $scope.service.archiveWebConfig.save(function () {
                        $scope.service.configurations.save($scope.service.configurationModel, function() {
                            $scope.success = true;
                            $scope.disableSave = false;
                            $location.path('/');
                        }, function() {
                            $scope.fail = true;
                            $scope.disableSave = false;
                        });

                    }, function() {
                        $scope.errorCopying = true;
                        $scope.disableSave = false;
                    });
                },function(response) {
                    $scope.validationService.pageValidations = response.data;
                    $scope.duplicatePath = response.data.duplicatePath;
                    $scope.duplicateEvent = response.data.duplicateEvent;
                    $scope.invalidBatchName = response.data.invalidBatchName;
                    $scope.missingBatchName = response.data.missingBatchName;
                    $scope.missingApiEndpointName = response.data.missingApiEndpointName;
                    $scope.improperFileDefinitions = response.data.improperFileDefinitions;
                    $scope.disableSave = false;
                });
            }
        }

        function concatenateDaysToRun() {
            $scope.service.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun = $scope.service.configurationModel.campusLogicSection.isirUploadSettings.isirUploadDaysToRun.join(",");
            $scope.service.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun = $scope.service.configurationModel.campusLogicSection.awardLetterUploadSettings.awardLetterUploadDaysToRun.join(",");
            $scope.service.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun = $scope.service.configurationModel.campusLogicSection.fileMappingUploadSettings.fileMappingUploadDaysToRun.join(",");
            $scope.service.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun = $scope.service.configurationModel.campusLogicSection.dataFileUploadSettings.dataFileUploadDaysToRun.join(",");
            $scope.service.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun = $scope.service.configurationModel.campusLogicSection.isirCorrectionsSettings.daysToRun.join(",");
        }

        function validateStep() {
            var form = null;
            switch ($scope.activeStep) {
                case '/appSettings':
                    form = $scope.formAppSettings;
                    break;
                case '/credentials':
                    form = $scope.credentialsForm;
                    break;
                case '/environment':
                    form = $scope.environmentForm;
                    break;
                case '/eventnotifications':
                    form = $scope.formEventNotifications;
                    break;
                case '/smtp':
                    form = $scope.smtpForm;
                    break;
                case '/isirUpload':
                    break;
                case '/awardLetterUpload':
                    break;
                case 'dataFileUpload':
                    break;
                case '/isircorrections':
                    break;
                case '/storedprocedure':
                    form = null;
                    break;
                case '/document':
                    form = $scope.documentForm;
                    break;
                case '/documentImports':
                    break;
                case '/filestore':
                    form = $scope.fileStoreForm;
                    break;
                case '/awardLetterPrint':
                    form = $scope.fileStoreForm;
                    break;
                case '/awardLetterFileMappingUpload':
                    form = $scope.awardLetterFileMappingUploadForm;
                    break;
                case '/batchprocessing':
                    form = $scope.batchProcessingForm;
                    break;
                case '/apiintegration':
                    form = $scope.apiIntegrationForm;
                    break;
                case '/bulkAction':
                    break;
                case '/filedefinitions':
                    form = $scope.fileDefinitionsForm;
                    break;
                case '/powerfaids':
                    form = $scope.powerFaidsForm;
                    break;
                default:
                    return;
            }
            $scope.validationService.validateStep($scope.activeStep, form);
        }

        function validateAllSteps() {
            $scope.validationService.validateAllSteps();
        }
    }
})();
