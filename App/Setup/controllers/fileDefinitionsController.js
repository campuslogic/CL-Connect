(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('fileDefinitionsController', fileDefinitionsController);

    fileDefinitionsController.$inject = ['$scope', '$compile', 'setupservice', 'addfiledefinitionmodalcontroller', 'validationservice'];

    function fileDefinitionsController($scope, $compile, setupservice, addfiledefinitionmodalcontroller, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.addfiledefinitionmodalcontroller = addfiledefinitionmodalcontroller;
        vm.pageValid = validationservice.pageValidations.fileDefinitionSettingsValid;
        onLoad();

        function onLoad() {
            vm.fileDefinitionsList = vm.service.configurationModel.campusLogicSection.fileDefinitionsList;

            vm.gridOptions = {
                columns:
                [{ 'field': 'name', title: 'Name' },
                { 'field': 'fileNameFormat', title: 'File Name Format' },
                { 'field': 'includeHeaderRecord', title: 'Include Header Record' },
                { 'field': 'fileExtension', title: 'Extension' },
                { 'field': 'fileFormat', title: 'File Format' },
                {
                    command: [
                        {
                            template: kendo.template($("#file-definitions-template").html())
                        }],
                    width: "120px"
                }]
            };
        }

        vm.refreshGrid = function () {
            $('#file-definitions-grid').data('kendoGrid').dataSource.read();
        };

        vm.addFileDefinition = function () {
            vm.addfiledefinitionmodalcontroller.open(null, vm.fileDefinitionsList).result.then(function (fileDefinition) {
                vm.fileDefinitionsList.push(fileDefinition);
                vm.refreshGrid();
            });
        };

        vm.getIndex = function (name) {
            for (var i = 0; i < vm.fileDefinitionsList.length; i++) {
                if (vm.fileDefinitionsList[i].name === name) {
                    return i;
                }
            }

            return -1;
        }

        vm.edit = function (fileDefinition) {
            vm.addfiledefinitionmodalcontroller.open(fileDefinition, vm.fileDefinitionsList).result.then(function (ret) {
                vm.fileDefinitionsList[vm.getIndex(fileDefinition.name)] = ret;
                vm.refreshGrid();
            });
        };

        vm.delete = function (name) {
            vm.fileDefinitionsList.splice(vm.getIndex(name), 1);
            vm.refreshGrid();
        };
    }
})();