(function () {
    'use strict';

    angular
        .module('clConnectControllers')
        .controller('dbcontroller', dbcontroller);

    dbcontroller.$inject = ['dbservice'];

    function dbcontroller(dbservice) {
        /* jshint validthis:true */
        var vm = this;
        vm.setdbSize = setDBSize();

        function setDBSize() {
            dbservice.dbSize.get(function (response) {
                vm.dbSize = response.size;
                vm.isLocal = response.isLocal;
            });
        }
    }
})();
