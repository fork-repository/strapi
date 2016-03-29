'use strict';

/**
 * Module dependencies
 */

// Node.js core.
const path = require('path');

// Public node modules.
const _ = require('lodash');
const async = require('async');

// Strapi utilities.
const dictionary = require('strapi-utils').dictionary;

/**
 * Async module loader to create a
 * dictionary of the user APIs.
 */

module.exports = function (strapi) {
  const hook = {

    /**
     * Initialize the hook
     */

    initialize: function (cb) {
      _.forEach(strapi.api, function (definition, api) {
        async.auto({

          // Expose the `name` of the API for the callback.
          'name': function (cb) {
            cb(null, api);
          },

          // Load API controllers from `./api/*/controllers/*.js`.
          'controllers/*': function (cb) {
            dictionary.optional({
              dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.controllers),
              filter: /(.+)\.(js)$/,
              depth: 1
            }, cb);
          },

          // Load API models from `./api/*/models/*.js` and `./api/*/models/*.settings.json`.
          'models/*': function (cb) {
            async.parallel({
              settings: function (cb) {
                dictionary.optional({
                  dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.models),
                  filter: /(.+)\.settings.json$/,
                  depth: 1
                }, cb);
              },
              functions: function (cb) {
                dictionary.optional({
                  dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.models),
                  filter: /(.+)\.js$/,
                  depth: 1
                }, cb);
              }
            }, function (err, models) {
              if (err) {
                return cb(err);
              }
              return cb(null, _.merge(models.settings, models.functions));
            });
          },

          // Load API services from `./api/*/services/*.js`.
          'services/*': function (cb) {
            dictionary.optional({
              dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.services),
              filter: /(.+)\.(js)$/,
              depth: 1
            }, cb);
          },

          // Load API policies from `./api/*/policies/*.js`.
          'policies/*': function (cb) {
            dictionary.aggregate({
              dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.policies),
              filter: /(.+)\.(js)$/,
              depth: 1
            }, cb);
          },

          // Load API config from `./api/*/config/*.js|json` and `./api/*/config/environments/**/*.js|json`.
          'config/**': function (cb) {
            async.parallel({
              common: function (cb) {
                dictionary.aggregate({
                  dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.config),
                  filter: /(.+)\.(js|json)$/,
                  depth: 2
                }, cb);
              },
              specific: function (cb) {
                dictionary.aggregate({
                  dirname: path.resolve(strapi.config.appPath, strapi.config.paths.api, api, strapi.config.paths.config, 'environments', strapi.config.environment),
                  filter: /(.+)\.(js|json)$/,
                  depth: 2
                }, cb);
              }
            }, function (err, config) {
              if (err) {
                return cb(err);
              }
              return cb(null, _.merge(config.common, config.specific));
            });
          }
        },

        // Callback.
        function (err, api) {

          // Just in case there is an error.
          if (err) {
            return cb(err);
          }

          // Expose the API dictionary.
          strapi.api[api.name] = {
            controllers: api['controllers/*'],
            models: api['models/*'],
            services: api['services/*'],
            policies: api['policies/*'],
            config: api['config/**']
          };

          // Delete the definition if it's empty.
          _.forEach(strapi.api[api.name], function (dictionary, entry) {
            if (_.isEmpty(strapi.api[api.name][entry])) {
              delete strapi.api[api.name][entry];
            }
          });

          // If the module doesn't have a definition at all
          // just remove it completely from the dictionary.
          if (_.isEmpty(strapi.api[api.name])) {
            delete strapi.api[api.name];
          }

          // Merge API controllers with the main ones.
          strapi.controllers = _.merge({}, strapi.controllers, _.get(strapi.api, api.name + '.controllers'));

          // Merge API services with the main ones.
          strapi.services = _.merge({}, strapi.services, _.get(strapi.api, api.name + '.services'));

          // Merge API models with the main ones.
          strapi.models = _.merge({}, strapi.models, _.get(strapi.api, api.name + '.models'));

          // Merge API policies with the main ones.
          strapi.policies = _.merge({}, strapi.policies, _.get(strapi.api, api.name + '.policies'));

          // Merge API routes with the main ones.
          strapi.config.routes = _.merge({}, strapi.config.routes, _.get(strapi.api, api.name + '.config.routes'));
        });
      });

      cb();
    }
  };

  return hook;
};
