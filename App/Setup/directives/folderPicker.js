(function () {

    'use strict';

    angular.module("clConnectDirectives").directive("clFolderPicker", ['validationservice', '$modal',
        function (validationservice, $modal) {

            var urlRoot = '';
            urlRoot = $("base").first().attr("href");

            /// <summary>
            /// This directive allows the user to manually enter a folder path, or select a folder from a modal
            /// </summary>
            return {
                restrict: "E",
                templateUrl: urlRoot + '/setup/template/template?templateName=FolderPicker',
                scope: {
                    uploadpath: '=',
                    formvalid: '=',
                    isrequired: '='
                },
                link: function (scope, element, attrs) {
                    scope.validationService = validationservice;
                    scope.testReadWritePermissions = testReadWritePermissions;
                    scope.validateFolderPathUnique = validateFolderPathUnique;
                    scope.validPath = true;
                    scope.pathValidated = false;
                    scope.folderPathUnique = true;
                    validateFolderPathUnique();

                    if (scope.uploadpath !== '' && scope.uploadpath !== undefined) {
                        testReadWritePermissions();
                    }

                    function validateFolderPathUnique() {
                        scope.folderPathUnique = scope.validationService.folderPathUnique(scope.uploadpath);
                    }

                    scope.openFolderExplorer = function () {
                        scope.open();
                    }

                    function testReadWritePermissions() {
                        try {
                            scope.folderPathUnique = scope.validationService.folderPathUnique(scope.uploadpath);
                            scope.pathValidated = false;
                            if (scope.folderPathUnique) {
                                scope.validationService.testReadWritePermissions.get({ directoryPath: scope.uploadpath }, function (response) {
                                    scope.pathValidated = true;
                                    scope.validPath = true;
                                }, function (error) {
                                    scope.pathValidated = true;
                                    scope.validPath = false;
                                });
                            }
                        } catch (exception) {
                            scope.pathValidated = true;
                            scope.validPath = false;
                        }
                    };

                    scope.modalController = [
                        "$rootScope", "$scope", "$modalInstance", "modalParams", function ($rootScope, $scope, $modalInstance) {
                            $scope.treeData = new kendo.data.HierarchicalDataSource({
                                transport: {
                                    read: function (options) {
                                        var id = options.data.path;
                                        $.ajax({
                                            url: "api/folderpicker/openfolderexplorer",
                                            data: { directoryPath: id || "" },
                                            dataType: "json",
                                            success: function (result) {
                                                options.success(result);
                                            }
                                        });
                                    }
                                },
                                schema: {
                                    model: {
                                        id: "path",
                                        name: "name",
                                        path: "path",
                                        hasChildren: "hasChildren"
                                    }
                                }
                            });

                            $scope.closeModal = function () {
                                $modalInstance.close();
                                $('#folderPath').focus();
                                if ($('#folderPath:eq( 1 )')) {
                                    $('#folderPath:eq( 1 )').focus();
                                }
                            };

                            $scope.selectFolderPath = function () {
                                var treeView = $("#folderpicker-treeview").data('kendoTreeView');
                                var selected = treeView.select();
                                var selectedItem = treeView.dataItem(selected);
                                var selectedItemId = selectedItem.id;
                                scope.uploadpath = selectedItemId;
                                $scope.closeModal();
                            }
                        }
                    ],

                    scope.open = function () {
                        //Open modal
                        var $modalInstance = $modal.open({
                            templateUrl: urlRoot + "/setup/template/template?templateName=FolderPickerModal",
                            controller: scope.modalController,
                            resolve: {
                                modalParams: function () {
                                    return {
                                    };
                                }
                            },
                            backdrop: 'static',
                            windowClass: "full-screen-modal show"
                        });
                        //Done
                        return $modalInstance;
                    }

                }
            }
        }
    ]);
}());