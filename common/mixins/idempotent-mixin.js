/**
 *
 * ©2016-2017 EdgeVerve Systems Limited (a fully owned Infosys subsidiary),
 * Bangalore, India. All Rights Reserved.
 *
 */

/**
 * This mixin is to support eventual consistency. This mixin support patterns of
 * Idempotent behavior or replay behavior, which will enable framework to perform actions
 * multiple times and preserve the same outcome. The system maintains this
 * behavior in CRUD operations.
 *
 * Idempotent behavior – The ability to perform the same operation multiple time
 * and always receive the same results
 *
 * @mixin Idempotent mixin
 * @author Praveen
 */

var mergeQuery = require('loopback-datasource-juggler/lib/utils').mergeQuery;

module.exports = function IdempotencyMixin(Model) {
  Model.checkIdempotency = function modelCheckIdempotency(ctx, cb) {
    var data = ctx.data || ctx.instance;
    if (ctx.currentInstance && data) {
      if (ctx.currentInstance._version === data._newVersion) {
        return cb(null, ctx.currentInstance);
      }
    }

    if (ctx.isNewInstance) {
      data._newVersion = data._newVersion || data._version;
    }

    if (data._newVersion && ctx.isNewInstance) {
      // create case
      var whereClause = {
        '_version': data._newVersion
      };
      Model.find({
        where: whereClause
      }, ctx.options, function modelFindcb(err, result) {
        if (err) {
          return cb(err);
        }
        if (result && result.length) {
          return cb(err, result[0]);
        }
        return findInHistory();
      });
    } else if (data._newVersion) {
      // update case by id
      if (ctx.currentInstance && ctx.currentInstance._version === data._newVersion) {
        return cb(null, ctx.currentInstance);
      }
      return findInHistory();
    } else {
      return cb();
    }

    function findInHistory() {
      if (!Model._historyModel) {
        return cb();
      }
      whereClause = {
        '_version': data._newVersion
      };
      Model._historyModel.find({
        where: whereClause
      }, ctx.options, function historyModelFindcb(err, result) {
        if (err) {
          return cb(err);
        }
        if (result && result.length) {
          if (ctx.currentInstant) {
            return cb(null, ctx.currentInstant);
          }
          var hinst = result[0];
          Model.findById(hinst.id, ctx.options, function modelFindByIdcb(err, latestInst) {
            return cb(err, latestInst);
          });
        } else {
          return cb();
        }
      });
    }
  };

  Model.checkIdempotencyForDelete = function modelCheckIdempotencyForDeletecb(context, cb) {
    var filter;
    if (context.id) {
      filter = { where: context.where, fetchDeleted: true };
      Model.findOne(filter, context.options, function modelFindOnecb(err, res) {
        if (err) {
          return cb(err);
        }
        if (res) {
          return cb(err, { count: 1 });
        }
        return cb();
      });
    } else if (context.options && context.options.requestId) {
      filter = { where: context.where, fetchDeleted: true };
      mergeQuery(filter, {
        where: {
          _requestId: context.options.requestId
        }
      });
      Model.find(filter, context.options, function modelFindcb(err, res) {
        if (err) {
          return cb(err);
        }
        if (res.length > 0) {
          return cb(err, { count: res.length });
        }
        return cb();
      });
    } else {
      return cb();
    }
  };
};
