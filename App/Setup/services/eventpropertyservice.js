(function () {
    'use strict';

    angular
        .module('clConnectServices')
        .factory('eventpropertyservice', eventpropertyservice);

    eventpropertyservice.$inject = ['$resource'];

    function eventpropertyservice($resource) {
        var service = {
            updateEventProperties: $resource('api/EventProperty/UpdateEventProperties'),
            updateEventPropertiesWithCredentials: $resource('api/EventProperty/updateEventPropertiesWithCredentials/', { username: "@username", password: "@password", environment: "@environment" }),
            getEventPropertyDisplayNames: $resource('api/EventProperty/GetEventPropertyDisplayNames')
        };

        return service;
    }
})();