(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('batchProcessingController', batchProcessingController);

    batchProcessingController.$inject = ['$scope', '$compile', 'setupservice', 'addbatchprocessmodalcontroller', 'validationservice'];

    function batchProcessingController($scope, $compile, setupservice, addbatchprocessmodalcontroller, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.addbatchprocessmodalcontroller = addbatchprocessmodalcontroller;
        vm.refreshGrid = refreshGrid;
        vm.validationService = validationservice;
        $scope.pageValid = validationservice.pageValidations.batchProcessingSettingsValid;
        $scope.addBatchProcess = addBatchProcess;
        $scope.editBatchProcess = editBatchProcess;
        $scope.deleteBatchProcess = deleteBatchProcess;
        $scope.getDisplayName = getDisplayName;
        onLoad();

        $scope.awardLetterPrint = {
            batchName: null,
            maxBatchSize: 0,
            filePath: '',
            fileNameFormat: '',
            batchExecutionMinutes: 0
        };

        $scope.gridOptions = [];
        
        $scope.gridOptions['awardLetterPrint'] = {
            columns:
                [{ 'field': 'batchName', title: 'Batch Name' },
                 { 'field': 'maxBatchSize', title: 'Max Batch Size' },
                 { 'field': 'filePath', title: 'File Path' },
                 { 'field': 'fileNameFormat', title: 'File Name Format' },
                 { 'field': 'batchExecutionMinutes', title: 'Batch Execution Minutes' },
                 { 'field': 'fileDefinitionName', title: 'File Definition' },
                 {
                     command: [
                     {
                         template: kendo.template($("#add-batch-process-collection-template").html())
                     }
                     ],
                     width: "120px"
                 }]
        };
        
        $scope.model = {
            typeName: null,
            batchProcesses: []
        };
        $scope.bpvalidation = false;

        function onLoad() {
            $scope.batchProcessingTypesList = vm.service.configurationModel.campusLogicSection.batchProcessingTypesList;
            for (var i = 0; i < $scope.batchProcessingTypesList.length; i++) {
                $scope.batchProcessingTypesList[i].typeName = $scope.batchProcessingTypesList[i].typeName.split(' ').join('_');
                for (var j = 0; j < $scope.batchProcessingTypesList[i].batchProcesses.length; j++) {
                    $scope.batchProcessingTypesList[i].batchProcesses[j].index = j;
                }
            }
        }

        function addBatchProcess(batchProcessingType) {
            vm.addbatchprocessmodalcontroller.open(null, batchProcessingType, getDisplayName(batchProcessingType.typeName)).result.then(function () {
                vm.refreshGrid(batchProcessingType.typeName);
            });
        }

        function deleteBatchProcess(batchProcessingType, dataItem) {
            batchProcessingType.batchProcesses.splice(dataItem.index, 1);
            vm.refreshGrid(batchProcessingType.typeName);
        }

        function editBatchProcess(batchProcessingType, dataItem) {
            vm.addbatchprocessmodalcontroller.open(dataItem, batchProcessingType, getDisplayName(batchProcessingType.typeName))
            .result.then(function () {
                vm.refreshGrid(batchProcessingType.typeName);
            });
        }

        function refreshGrid(typeName) {
            $('#' + typeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).data('kendoGrid').dataSource.read();
        }

        function getDisplayName(typeName) {
            switch (typeName) {
                case "awardLetterPrint":
                    return "AwardLetter Print";
                default:
                    return "";
            }
        }

        $scope.add = function () {
            for (var i = 0; i < $scope.batchProcessingTypesList.length; i++) {
                if ($scope.batchProcessingTypesList[i].typeName === $scope.model.batchProcessingType) {
                    $scope.bpvalidation = true;
                    return;
                }
            }
            $scope.bpvalidation = false;
            $scope.batchProcessingTypesList.push({
                typeName: $scope.model.batchProcessingType,
                batchProcesses: []
            });
        };

        $scope.deleteBatchProcessingType = function (batchProcessingType) {
            for (var i = 0; i < $scope.batchProcessingTypesList.length; i++) {
                if ($scope.batchProcessingTypesList[i].typeName === batchProcessingType.typeName) {
                    $scope.batchProcessingTypesList.splice(i, 1);
                    return;
                }
            }
        };
    }
})();