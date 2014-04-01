// ----------------------------------------------------------------------------
// File: Arcball.js
//
// Copyright (c) 2014 Voodoojs Authors
// ----------------------------------------------------------------------------



/**
 * The view that controls the arcball rotation of scene meshes.
 *
 * @constructor
 * @private
 * @extends {voodoo.View}
 */
var ArcballView_ = voodoo.View.extend({

  load: function() {
    this.base.load();
  },

  computeArcballSphere: function() {
    var modelArcballCenter = this.model.arcballCenter;
    var modelArcballRadius = this.model.arcballRadius;

    if (modelArcballCenter && modelArcballRadius) {
      // The arcball sphere is fully defined. use it.
      this.arcballCenter_ = modelArcballCenter;
      this.arcballRadius_ = modelArcballRadius;
    } else {
      // Find the average center of all meshes.
      this.arcballCenter_ = { x: 0, y: 0, z: 0 };
      this.arcballRadius_ = 0;
      var numObjects = 0;

      var geometryCenters = [];

      var sceneObjects = this.scene.objects;
      for (var i = 0, len = sceneObjects.length; i < len; ++i) {
        var sceneObject = sceneObjects[i];
        var geometry = sceneObject['geometry'];

        if (geometry) {
          var sceneObjectPosition = sceneObject.position;
          var sceneObjectScale = sceneObject.scale;
          var geometryBoundingSphereCenter = geometry.boundingSphere.center;

          var px = sceneObjectPosition.x * sceneObjectScale.x +
              geometryBoundingSphereCenter.x * sceneObjectScale.x;
          var py = sceneObjectPosition.y * sceneObjectScale.y +
              geometryBoundingSphereCenter.y * sceneObjectScale.y;
          var pz = sceneObjectPosition.z * sceneObjectScale.z +
              geometryBoundingSphereCenter.z * sceneObjectScale.z;

          geometryCenters.push([px, py, pz]);

          this.arcballCenter_.x += px;
          this.arcballCenter_.y += py;
          this.arcballCenter_.z += pz;

          numObjects++;
        }
      }

      if (numObjects !== 0) {
        this.arcballCenter_.x /= numObjects;
        this.arcballCenter_.y /= numObjects;
        this.arcballCenter_.z /= numObjects;
      } else return;

      // Determine the radius
      for (var i = 0, len = sceneObjects.length; i < len; ++i) {
        var sceneObject = sceneObjects[i];
        var geometry = sceneObject['geometry'];

        if (geometry) {
          var sceneObjectScale = sceneObject.scale;
          var geometryBoundingSphere = geometry.boundingSphere;

          var geometryCenter = geometryCenters[i];

          var dx = geometryCenter[0] - this.arcballCenter_.x;
          var dy = geometryCenter[1] - this.arcballCenter_.y;
          var dz = geometryCenter[2] - this.arcballCenter_.z;

          var scale = Math.max(sceneObjectScale.x,
              Math.max(sceneObjectScale.y, sceneObjectScale.z));

          var distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          var radius = distance + geometryBoundingSphere.radius * scale;
          if (radius > this.arcballRadius_)
            this.arcballRadius_ = radius;
        }
      }

      // If there are relevant properties, copy them over.
      if (modelArcballCenter)
        this.arcballCenter_ = modelArcballCenter;
      if (modelArcballRadius)
        this.arcballRadius_ = modelArcballRadius;
    }

    var center = this.scene.localToPage(this.arcballCenter_);
    return {
      center: center,
      radius: Math.abs(this.scene.localToPage(
          [this.arcballCenter_.x - this.arcballRadius_, 0, 0])[0] -
          center.x)
    };
  }

});



/**
 * An arcball controller that lets the user rotate scene meshes using
 * the mouse.
 *
 * Options:
 *
 * - arcballCenter {Object} Center of the arcball sphere. If null, then
 *     this will be calculated from the aggreate bounding sphere of meshes.
 *     Default is null.
 * - arcballRadius {number} Radius of the arcball sphere. If 0, then
 *     this will be calculated from the aggegate bounding sphere of meshes.
 *     Default is 0.
 *
 *
 * @constructor
 * @extends {voodoo.Model}
 *
 * @param {Object=} opt_options Options object.
 */
var Arcball = this.Arcball = Rotator.extend({

  name: 'Arcball',
  organization: 'spellbook',
  viewType: ArcballView_,

  initialize: function(options) {
    this.base.initialize(options);

    this.arcballCenter = options.arcballCenter || null;
    this.arcballRadius = typeof options.arcballRadius !== 'undefined' ?
        options.arcballRadius : 0;

    this.rotatingArcball = false;
    this.startArcballRotation_ = new THREE.Quaternion(0, 0, 0, 1);
  },

  setUpViews: function() {
    this.base.setUpViews();

    var that = this;

    this.on('mousemove', function(e) {
      if (that.rotatingArcball) {
        var p = that.mapOntoSphere_(e.page.x, e.page.y);

        var a = new THREE.Vector3(
            that.arcballAnchorPoint_.x,
            that.arcballAnchorPoint_.y,
            that.arcballAnchorPoint_.z);

        var b = new THREE.Vector3(
            p.x,
            p.y,
            p.z);

        var axis = new THREE.Vector3();
        axis.crossVectors(a, b);
        axis.normalize();

        var dot = a.dot(b);
        var angle = Math.acos(dot);

        var q = new THREE.Quaternion(0, 0, 0, 0);
        q.setFromAxisAngle(axis, angle * 2);
        q.normalize();

        that.currentArcballRotation_ = new THREE.Quaternion(0, 0, 0, 1);
        that.currentArcballRotation_.multiplyQuaternions(
            q, that.startArcballRotation_);

        var eulerAngles = new THREE.Euler(0, 0, 0, 'XYZ');
        eulerAngles.setFromQuaternion(that.currentArcballRotation_, 'XYZ');
        that.setRotation(eulerAngles.x, eulerAngles.y, eulerAngles.z);
      }
    });

    this.on('mousedown', function(e) {
      that.arcballSphere_ = that.view.computeArcballSphere();
      if (that.stencilView)
        that.stencilView.computeArcballSphere();

      that.arcballAnchorPoint_ = that.mapOntoSphere_(e.page.x, e.page.y);
      that.rotatingArcball = true;
    });

    this.on('mouseup', function() {
      that.rotatingArcball = false;
      that.startArcballRotation_ = that.currentArcballRotation_;
    });
  },

  mapOntoSphere_: function(x, y) {
    var arcballSphereCenter = this.arcballSphere_.center;
    var arcballSphereRadius = this.arcballSphere_.radius;

    var dx = x - arcballSphereCenter.x;
    var dy = y - arcballSphereCenter.y;

    var length2 = dx * dx + dy * dy;
    var radius2 = this.arcballSphere_.radius * this.arcballSphere_.radius;

    if (length2 < radius2) {
      var dz = Math.sqrt(radius2 - length2);
    } else {
      var length = Math.sqrt(length2);
      var scaleIn = arcballSphereRadius / length;

      dx *= scaleIn;
      dy *= scaleIn;
      dz = 0;
    }

    // Normalize
    length = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return { x: dx / length, y: dy / length, z: dz / length };
  }

});


/**
 * Center of the arcball sphere. If null, then this will be calculated from
 * the aggreate bounding sphere of meshes. Default is null.
 *
 * @type {Object}
 */
Arcball.prototype.arcballCenter = null;


/**
 * Radius of the arcball sphere. If 0, then this will be calculated from the
 * aggegate bounding sphere of meshes. Default is 0.
 *
 * @type {number}
 */
Arcball.prototype.arcballRadius = 0;