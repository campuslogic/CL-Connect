'use strict';

var clConnectServices = angular.module("clConnectServices");

clConnectServices.factory("addfiledefinitionmodalcontroller", ["$modal",
    function ($modal) {
        var urlRoot = '';
        urlRoot = $("base").first().attr("href");

        var service = {
            modalController: ["$rootScope", "$scope", "$modalInstance", "setupservice", "modalParams", "addfieldmappingmodalcontroller", 
                function ($rootScope, $scope, $modalInstance, setupservice, modalParams, addfieldmappingmodalcontroller) {
                    $scope.service = setupservice;
                    $scope.addfieldmappingmodalcontroller = addfieldmappingmodalcontroller;
                    $scope.theItem = modalParams.theItem;
                    $scope.theList = modalParams.theList;

                    if (modalParams.theItem === undefined || modalParams.theItem === null) {
                        $scope.modelCopy = {
                            name: null,
                            fileNameFormat: null,
                            includeHeaderRecord: null,
                            fileExtension: null,
                            fileFormat: null,
                            fieldMappingCollection: [],
                            index: $scope.theList.length
                        };
                        $scope.modalType = "Add";
                    } else {
                        $scope.modelCopy = angular.copy(modalParams.theItem);
                        $scope.modalType = "Edit";
                    }

                    $scope.formIsValid = function () {
                        var formIsValid = true;
                        $scope.nameIsValid = true;
                        $scope.nameIsDuplicate = false;
                        $scope.fileNameFormatIsValid = true;
                        $scope.includeHeaderRecordIsValid = true;
                        $scope.fileExtensionIsValid = true;
                        $scope.fieldMappingLengthIsValid = true;
                        $scope.xmlFieldNamesAreValid = true;
                        $scope.csvFieldNamesAreValid = true;

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.name)) {
                            formIsValid = false;
                            $scope.nameIsValid = false;
                        }

                        var nameMatches = $.grep($scope.theList, function (fileDefinition) {
                            return fileDefinition.name === $scope.modelCopy.name && fileDefinition.index !== $scope.modelCopy.index;
                        });

                        if (nameMatches.length > 0) {
                            formIsValid = false;
                            $scope.nameIsDuplicate = true;
                        }

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.fileNameFormat)) {
                            formIsValid = false;
                            $scope.fileNameFormatIsValid = false;
                        }

                        if ($scope.modelCopy.includeHeaderRecord == null) {
                            formIsValid = false;
                            $scope.includeHeaderRecordIsValid = false;
                        }

                        if ($rootScope.isNullOrWhitespace($scope.modelCopy.fileExtension)) {
                            formIsValid = false;
                            $scope.fileExtensionIsValid = false;
                        }

                        if ($scope.modelCopy.fieldMappingCollection.length == 0) {
                            formIsValid = false;
                            $scope.fieldMappingLengthIsValid = false;
                        }

                        if ($scope.modelCopy.fileFormat == "xml") {
                            for (var i = 0; i < $scope.modelCopy.fieldMappingCollection.length; i++) {
                                var fieldMapping = $scope.modelCopy.fieldMappingCollection[i];

                                if (fieldMapping.fileFieldName.indexOf(' ') >= 0) {
                                    formIsValid = false;
                                    $scope.xmlFieldNamesAreValid = false;
                                }
                            }
                        }

                        if ($scope.modelCopy.includeHeaderRecord == true && $scope.modelCopy.fileFormat == "csv" || $scope.modelCopy.fileFormat == "csvnoquotes") {
                            for (var i = 0; i < $scope.modelCopy.fieldMappingCollection.length; i++) {
                                var fieldMapping = $scope.modelCopy.fieldMappingCollection[i];

                                if (fieldMapping.fileFieldName.indexOf(',') >= 0) {
                                    formIsValid = false;
                                    $scope.csvFieldNamesAreValid = false;
                                }
                            }
                        }

                        return formIsValid;
                    }

                    $scope.closeModal = function () {
                        $modalInstance.close($scope.modelCopy);
                    };

                    $scope.save = function () {
                        if ($scope.formIsValid()) {
                            $scope.closeModal();
                        }

                        return null;
                    };
                    
                    $scope.fieldMappingCollectionGridOptions = {
                        dataSource: $scope.modelCopy.fieldMappingCollection,
                        sortable: false,
                        pageable: false,
                        resizable: true,
                        scrollable: true,
                        columns: [
                            { field: "fieldPosition", title: "Position" },
                            { field: "fieldSize", title: "Size" },
                            { field: "dataType", title: "Data Type" },
                            { field: "fileFieldName", title: "Field Name" },
                            { field: "propertyFieldValue", title: "Property Value" },
                            { field: "constantFieldValue", title: "Constant Value" },
                            { field: "dbCommandFieldValue", title: "Database Command" },
                            { field: "dynamicFieldValue", title: "Dynamic Value" },
                            {
                                command: [
                                    {
                                        template: kendo.template('<button class="btn btn-light" ng-click="moveUpFieldMappingItem(dataItem)"><i class="fa fa-arrow-up"></i></button>' +
                                            '<button class="btn btn-light" ng-click="moveDownFieldMappingItem(dataItem)"><i class="fa fa-arrow-down"></i></button>' +
                                            '<button class="btn btn-light" ng-click="editFieldMappingItem(dataItem)"><i class="fa fa-pencil"></i></button>' +
                                            '<button class="btn btn-light" ng-click="deleteFieldMappingItem(dataItem)"><i class="fa fa-trash"></i></button>')
                                    }
                                ],
                                width: "250px"
                            }
                        ]
                    };

                    $scope.refreshGrid = function () {
                        $('#field-mappings-grid').data('kendoGrid').dataSource.read();
                    }

                    $scope.moveUpFieldMappingItem = function (dataItem) {
                        if (dataItem.fieldPosition > 1) {
                            var theList = $scope.modelCopy.fieldMappingCollection;
                            var moveDown = theList[dataItem.fieldPosition - 2];
                            moveDown.fieldPosition++;
                            dataItem.fieldPosition--;
                            theList[dataItem.fieldPosition - 1] = dataItem;
                            theList[moveDown.fieldPosition - 1] = moveDown;

                            $scope.refreshGrid();
                        }
                    }

                    $scope.moveDownFieldMappingItem = function (dataItem) {
                        var theList = $scope.modelCopy.fieldMappingCollection;
                        if (dataItem.fieldPosition < theList.length) {
                            var moveUp = theList[dataItem.fieldPosition];
                            moveUp.fieldPosition--;
                            dataItem.fieldPosition++;
                            theList[dataItem.fieldPosition - 1] = dataItem;
                            theList[moveUp.fieldPosition - 1] = moveUp;

                            $scope.refreshGrid();
                        }
                    }


                    $scope.deleteFieldMappingItem = function (dataItem) {
                        //update items below the one being deleted
                        for (var i = dataItem.fieldPosition; i < $scope.modelCopy.fieldMappingCollection.length; i++) {
                            $scope.modelCopy.fieldMappingCollection[i].fieldPosition--;
                        }
                        $scope.modelCopy.fieldMappingCollection.splice([dataItem.fieldPosition - 1], 1);

                        $scope.refreshGrid();
                    }

                    $scope.editFieldMappingItem = function (dataItem) {
                        $scope.addfieldmappingmodalcontroller.open(
                            dataItem,
                            dataItem.fieldPosition,
                            $scope.modelCopy.fieldMappingCollection,
                            $scope.service.configurationModel.campusLogicSection.eventPropertyValueAvailableProperties)
                            .result.then(function () {
                                $scope.refreshGrid();
                            });
                    }

                    $scope.addFieldMapping = function () {
                        $scope.addfieldmappingmodalcontroller.open(
                            null,
                            $scope.modelCopy.fieldMappingCollection.length + 1,
                            $scope.modelCopy.fieldMappingCollection,
                            $scope.service.configurationModel.campusLogicSection.eventPropertyValueAvailableProperties)
                            .result.then(function () {
                                $scope.refreshGrid();
                            });
                    }

                    $scope.updateFileFormat = function () {
                        if ($scope.modelCopy.fileFormat != "XML") {
                            $scope.xmlFieldNamesAreValid = true;
                        }

                        if ($scope.modelCopy.fileFormat != "csv" && $scope.modelCopy.fileFormat != "csvnoquotes") {
                            $scope.csvFieldNamesAreValid = true;
                        }
                    }
                }
            ],

            open: function (fileDefinition, fileDefinitionsList) {
                // Open modal
                var $modalInstance = $modal.open({
                    templateUrl: urlRoot + "/setup/template?templateName=AddFileDefinitionModal",
                    controller: service.modalController,
                    windowClass: "modal-wide show",
                    resolve: {
                        modalParams: function () {
                            return {
                                theItem: fileDefinition,
                                theList: fileDefinitionsList
                            };
                        }
                    },
                    backdrop: 'static'
                });

                return $modalInstance;
            }
        };

        return service;
    }]
);