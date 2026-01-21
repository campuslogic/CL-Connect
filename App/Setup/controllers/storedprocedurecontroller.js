(function () {
    'use strict';

    angular
    .module('clConnectControllers')
    .controller('storedprocedurecontroller', storedprocedurecontroller);

    storedprocedurecontroller.$inject = ['$scope', '$compile', 'setupservice', 'addparametermodalcontroller', 'validationservice'];


    function storedprocedurecontroller($scope, $compile, setupservice, addparametermodalcontroller, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.addparametermodalcontroller = addparametermodalcontroller;
        vm.refreshGrid = refreshGrid;
        $scope.pageValid = validationservice.pageValidations.storedProcedureValid;
        $scope.addParameter = addParameter;
        $scope.editParameter = editParameter;
        $scope.deleteParameter = deleteParameter;
        $scope.storedProcedureNameChange = storedProcedureNameChange;
        onLoad();

        $scope.gridOptions = {
            columns:
                [{ 'field': 'name', title: 'Name', 'width': 270 },
                { 'field': 'dataType', title: 'Data Type' },
                { 'field': 'length', title: 'Length' },
                { 'field': 'source', title: 'Source' },
                {
                    command: [
                    {
                        template: kendo.template($("#add-parameter-collection-template").html())
                    }
                    ],
                    width: "20%"
                }]

        }

        $scope.i = 0;
        $scope.model = {
            storedProcedureName: null,
            storedProcedureGridName: '',
            name: '',
            source: '',
            dataType: '',
            length: ''
        }
        $scope.spvalidation = false;

        function onLoad() {
            $scope.storedProcedureList = vm.service.configurationModel.campusLogicSection.storedProcedureList;
            for (var i = 0; i < $scope.storedProcedureList.length; i++) {
                $scope.storedProcedureList[i].storedProcedureGridName = $scope.storedProcedureList[i].name.split(' ').join('_');
                for (var j = 0; j < $scope.storedProcedureList[i].parameterList.length; j++) {
                    $scope.storedProcedureList[i].parameterList[j].index = j;
                }
            }
        }

        function storedProcedureNameChange(storedProcedure) {
            $scope.pageValid = true;
            validationservice.pageValidations.storedProcedureValid = true;
            storedProcedure.storedProcedureGridName = storedProcedure.storedProcedureName.split(' ').join('_');
        }

        function addParameter(storedProcedure) {
            var eventPropertyValues = setupservice.configurationModel.campusLogicSection.eventPropertyValueAvailableProperties;
            vm.addparametermodalcontroller.open(null, storedProcedure, eventPropertyValues).result.then(function () {
                    vm.refreshGrid(storedProcedure.storedProcedureGridName);
                });
        }

        function deleteParameter(storedProcedure, dataItem) {
            storedProcedure.parameterList.splice(dataItem.index, 1);
            vm.refreshGrid(storedProcedure.storedProcedureGridName);
        }

        function editParameter(storedProcedure, dataItem) {
            var eventPropertyValues = setupservice.configurationModel.campusLogicSection.eventPropertyValueAvailableProperties;
            vm.addparametermodalcontroller.open(dataItem, storedProcedure, eventPropertyValues)
            .result.then(function () {
                vm.refreshGrid(storedProcedure.storedProcedureGridName);
            });
        }

        function refreshGrid(storedProcedure) {
            
            $('#' + storedProcedure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).data('kendoGrid').dataSource.read();
        }

        $scope.add = function () {
            for (var i = 0; i < $scope.storedProcedureList.length; i++) {
                if ($scope.storedProcedureList[i].name === $scope.model.storedProcedureName) {
                    $scope.spvalidation = true;
                    return;
                }
            }
            $scope.spvalidation = false;
            $scope.storedProcedureList.push({
                name: $scope.model.storedProcedureName,
                storedProcedureGridName: $scope.model.storedProcedureGridName,
                parameterList: []
            });
        }

        $scope.deleteStoredProcedure = function (storedProcedure) {
            for (var i = 0; i < $scope.storedProcedureList.length; i++) {
                if ($scope.storedProcedureList[i].name === storedProcedure.name) {
                    $scope.storedProcedureList.splice(i, 1);
                    return;
                }
            }
        }

    }
})();