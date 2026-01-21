(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('powerFaidsController', powerFaidsController);

    powerFaidsController.$inject = ['$scope', '$compile', 'setupservice', 'addpowerfaidsmodalcontroller', 'validationservice'];

    function powerFaidsController($scope, $compile, setupservice, addpowerfaidsmodalcontroller, validationservice) {
        var vm = this;
        vm.service = setupservice;
        vm.addpowerfaidsmodalcontroller = addpowerfaidsmodalcontroller;
        vm.pageValid = validationservice.pageValidations.powerFaidsSettingsValid;
        vm.powerFaidsSettings = vm.service.configurationModel.campusLogicSection.powerFaidsSettings;
        vm.powerFaidsList = vm.service.configurationModel.campusLogicSection.powerFaidsList;

        vm.gridOptions = {
            columns:
                [{ 'field': 'event', title: 'Event' },
                { 'field': 'transactionCategory', title: 'Transaction Category' },
                {
                    'field': 'outcome', title: 'Outcome', template: function (dataItem) {
                        switch (dataItem.outcome) {
                            case "documents":
                                return "Documents";
                            case "verification":
                                return "Verification";
                            case "both":
                                return "Both";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'shortName', title: 'Short Name', template: function (dataItem) {
                        switch (dataItem.outcome) {
                            case "documents":
                            case "both":
                                return dataItem.shortName;
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'requiredFor', title: 'Required For', template: function (dataItem) {
                        switch (dataItem.requiredFor) {
                            case "D":
                                return "Disbursement";
                            case "P":
                                return "Packaging";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'status', title: 'Status', template: function (dataItem) {
                        switch (dataItem.status) {
                            case "1":
                                return "Received";
                            case "2":
                                return "Not Reviewed";
                            case "3":
                                return "Approved";
                            case "4":
                                return "Incomplete";
                            case "5":
                                return "Not Received";
                            case "6":
                                return "Not Signed";
                            case "7":
                                return "Waived";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'documentLock', title: 'Document Lock', template: function (dataItem) {
                        switch (dataItem.documentLock) {
                            case "Y":
                                return "Locked";
                            case "N":
                                return "Unlocked";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'verificationOutcome', title: 'Verification Outcome', template: function (dataItem) {
                        switch (dataItem.verificationOutcome) {
                            case "N":
                                return "Not Performed";
                            case "S":
                                return "Selected; Not Verified";
                            case "V":
                                return "Verified";
                            case "W":
                                return "Without Documentation";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    'field': 'verificationOutcomeLock', title: 'Verification Outcome Lock', template: function (dataItem) {
                        switch (dataItem.verificationOutcomeLock) {
                            case "Y":
                                return "Locked";
                            case "N":
                                return "Unlocked";
                            default:
                                return "N/A";
                        }
                    }
                },
                {
                    command: [
                        {
                            template: kendo.template($("#powerfaids-collection-template").html())
                        }
                    ],
                    width: "120px"
                }]
        }

        vm.addPowerFaidsRecord = function () {
            vm.addpowerfaidsmodalcontroller.open(null, vm.powerFaidsList).result.then(function () {
                vm.refreshGrid();
            });
        }

        vm.getIndex = function (event, transactionCategory) {
            for (var i = 0; i < vm.powerFaidsList.length; i++) {
                if (vm.powerFaidsList[i].event === event && vm.powerFaidsList[i].transactionCategory === transactionCategory) {
                    return i;
                }
            }

            return -1;
        }

        vm.editPowerFaidsRecord = function (dataItem) {
            dataItem.index = vm.getIndex(dataItem.event, dataItem.transactionCategory);
            vm.addpowerfaidsmodalcontroller.open(dataItem, vm.powerFaidsList).result.then(function () {
                vm.refreshGrid();
            });
        }

        vm.deletePowerFaidsRecord = function (dataItem) {
            vm.powerFaidsList.splice(vm.getIndex(dataItem.event, dataItem.transactionCategory), 1);
            vm.refreshGrid();
        }

        vm.refreshGrid = function () {
            $('#powerfaids-grid').data('kendoGrid').dataSource.read();
        }
    }
})();