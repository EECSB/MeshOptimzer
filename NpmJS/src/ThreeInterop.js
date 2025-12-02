//Includes///////////////////////////////////////

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { VRButton } from 'three/addons/webxr/VRButton.js';
import { ARButton } from 'three/addons/webxr/ARButton.js';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// meshoptimizer simplifier
import { MeshoptSimplifier } from 'meshoptimizer';
import { GUI } from 'lil-gui';
import { simplify } from 'meshoptimizer/meshopt_simplifier.js';


/////////////////////////////////////////////////



//Global variables///////////////////////////////

const params = { ratio: 1, error: 0.01, lockBorder: true };
let app;
let gui;

/////////////////////////////////////////////////



//C# Interop Functions///////////////////////////

//Init./////////////////////

window.registerThree = function () {

    let settings = {
        containerElement: document.getElementById("container"),
        containerSizeX: 0,
        containerSizeY: 0
    };
    settings.containerSizeX = settings.containerElement.clientWidth;
    settings.containerSizeY = settings.containerElement.clientHeight;

    app = new Viewer3D(settings);

    // Attach GUI to a specific element, e.g., an element with id "gui-container"
    const guiContainer = document.getElementById("container");
    gui = new GUI({ container: guiContainer || undefined });

    gui.add(params, 'ratio', 0, 1, 0.01);
    gui.add(params, 'error', 0, 0.25, 0.0001);
    gui.add(params, 'lockBorder');
    gui.onChange(app.simplify);

    // Add custom styling to the lil-gui container
    if (gui.domElement) {
        gui.domElement.style.position = 'absolute';
        gui.domElement.style.right = '0';
        gui.domElement.style.top = '0';

        // Hide GUI by default
        gui.domElement.style.display = 'none';
    }
}

////////////////////////////

window.startRender3DInterOp = function () {
    app.startRender3D();
}



window.load3dModelInterOp = function (data) {
    app.load3dModel(data);
}

window.load3dModelSimplifyTestInterOp = function (data) {
    app.load3dModelSimplifyTest(data);
}

window.load3dModelSimplifyInterOp = function (data) {
    app.load3dModelSimplify(data);
}



window.changeBackgroundInterOp = function (backgroundName) {
    app.changeBackground(backgroundName);
}

window.cinematicViewInterOp = function (cinematicViewToggleInterOp) {
    app.cinematicView(cinematicViewToggleInterOp);
}

window.download3DModelInterOp = function (CurrentlySelectedFileName, ModelDownloadFileType) {
    app.download3DModel(CurrentlySelectedFileName, ModelDownloadFileType);
}

/////////////////////////////////////////////////



class Viewer3D {

    //Initialize//////////////////////////////////////

    constructor(settings) {
        //Add settings.
        this.settings = settings;

        //Initialize the 3D viewer by adding all the needed compoents(renderer, scene, camera, ...).
        this.initializeViewer();

        //Setsup the initial scene by loading the background and "drawing" the first scene.
        this.setupInitialScene();
    }

    initializeViewer() {
        //Init. varibles//////////

        this.srcGeometry = null;
        this.dstGeometry = null;
        this.srcGeometryList = [];
        this.dstGeometryList = [];

        this.cinematicViewToggle = false;

        //////////////////////////

        //Create and init. the renderer.
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.settings.containerSizeX, this.settings.containerSizeY);
        this.renderer.setClearColor(0xDDDDDD, 1);
        this.renderer.xr.enabled = true; //Enable for VR.
        //
        this.settings.containerElement.appendChild(this.renderer.domElement);
        
        //Create a scene
        this.scene = new THREE.Scene();

        //Create and init. a camera and add it to the scene.
        this.camera = new THREE.PerspectiveCamera(100, this.settings.containerSizeX / this.settings.containerSizeY, 0.01, 50000);
        this.camera.position.z = 10;
        this.scene.add(this.camera);

        //Create objects group and add it to the scene.
        this.objectsGroup = new THREE.Group();
        this.scene.add(this.objectsGroup);

        //Create ambient light and add it to the scene.
        const light = new THREE.AmbientLight(0x404040); // soft white light
        this.scene.add(light);

        //Create a directional light and add it to scene.
        const directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(3, 3, 2);
        this.scene.add(directionalLight);
        
        //Create controls.
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        //Init. a texture loader. It will get used by changeBackground().
        this.textureLoader = new THREE.TextureLoader();

        this.cinematicSettings = {
            chipCenterPoint: new THREE.Vector3(),
            camera_offset: { x: 10, y: 10, z: 10 },
            camera_speed: 0.1,
            clock: new THREE.Clock()//,
            //time: 0
        };

        // Add VR button.
        const vrButton = VRButton.createButton(this.renderer);
        vrButton.style.position = 'absolute';
        vrButton.style.right = '20px';
        vrButton.style.bottom = '20px';
        this.settings.containerElement.appendChild(vrButton);

        // Add AR button.
        const arButton = ARButton.createButton(this.renderer, { requiredFeatures: ['hit-test'] });
        arButton.style.position = 'absolute';
        arButton.style.right = '20px';
        arButton.style.bottom = '70px'; // 50px above the VR button
        this.settings.containerElement.appendChild(arButton);

        // Create TransformControls for moving objects
        this.transformControls = new TransformControls(this.camera, this.renderer.domElement);
        this.scene.add(this.transformControls);

        // Prevent OrbitControls when using TransformControls
        this.transformControls.addEventListener('dragging-changed', (event) => {
            this.controls.enabled = !event.value;
        });

        this.transformControls.setMode('translate');
    }

    setupInitialScene() {
        //Init. background.
        this.changeBackground("background0.jpg");

        //Start animation/render loop.
        //this.startRender3D(); //Will be started by interop call from C# by Viewer3D.razor component.
    }

    /////////////////////////////////////////////////////////



    /////////////////////////////////////////////////////////

    startRender3D() {
        //requestAnimationFrame(this.startRender3D.bind(this)); //setAnimationLoop() needs to be used for VR.
        this.renderer.setAnimationLoop(this.animate.bind(this));
    }

    animate() {
        //Perform animations of objects or movements of camera.
        this.runCinematicView();//todo: optimize
        //this.runVR();

        /*if (resizeRendererToDisplaySize(this.renderer)) {
            const canvas = this.renderer.domElement;
            this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }*/

        //Call renderer to render the scene.
        this.renderer.render(this.scene, this.camera);
    }

    runCinematicView() {
        if (this.cinematicViewToggle) {
            const clock = this.cinematicSettings.clock;
            const chipCenterPoint = this.cinematicSettings.chipCenterPoint;
            const camera_offset = this.cinematicSettings.camera_offset;
            const camera_speed = this.cinematicSettings.camera_speed;

            clock.getDelta();
            const time = clock.elapsedTime.toFixed(2);

            this.camera.position.x = chipCenterPoint.x + camera_offset.x * (Math.sin(time * camera_speed));
            this.camera.position.z = chipCenterPoint.z + (camera_offset.z * Math.cos(time * 0.1)) * (Math.cos(time * camera_speed));
            this.camera.position.y = chipCenterPoint.y + camera_offset.y * (Math.cos(time * 0.05));

            this.camera.lookAt(chipCenterPoint.x, chipCenterPoint.y, chipCenterPoint.z);
        } else {
            this.camera.rotation.y += 0.0;
            this.camera.rotation.x += 0.0;
        }
    }



    simplify() {
        for (let i = 0; i < app.srcGeometryList.length; i++) {
            const srcGeometry = app.srcGeometryList[i];
            const dstGeometry = app.dstGeometryList[i];

            const srcIndexArray = srcGeometry.index.array;
            const srcPositionArray = srcGeometry.attributes.position.array;

            const targetCount = 3 * Math.floor(params.ratio * srcIndexArray.length / 3);

            const [dstIndexArray, error] = MeshoptSimplifier.simplify(
                srcIndexArray,
                srcPositionArray,
                3,
                targetCount,
                params.error,
                params.lockBorder ? ['LockBorder'] : [],
            );

            console.log(`targetCount: ${targetCount}, count: ${dstIndexArray.length}`);

            dstGeometry.index.array.set(dstIndexArray);
            dstGeometry.index.needsUpdate = true;

            dstGeometry.setDrawRange(0, dstIndexArray.length);
        }
    }

    simplifyTest() {
        const srcGeometry = app.srcGeometry;
        const dstGeometry = app.dstGeometry;

        const srcIndexArray = srcGeometry.index.array;
        const srcPositionArray = srcGeometry.attributes.position.array;

        const targetCount = 3 * Math.floor(params.ratio * srcIndexArray.length / 3);

        const [dstIndexArray, error] = MeshoptSimplifier.simplify(
            srcIndexArray,
            srcPositionArray,
            3,
            targetCount,
            params.error,
            params.lockBorder ? ['LockBorder'] : [],
        );

        console.log(`targetCount: ${targetCount}, count: ${dstIndexArray.length}`);

        dstGeometry.index.array.set(dstIndexArray);
        dstGeometry.index.needsUpdate = true;

        dstGeometry.setDrawRange(0, dstIndexArray.length);
    }

    async load3dModel(ByteArray3DModel) {
        // Hide GUI if not hidden already
        if (gui && gui.domElement && gui.domElement.style.display !== 'none') {
            gui.domElement.style.display = 'none';
        }

        // Convert the incoming .NET byte[] to a Blob and then to a URL for OBJLoader
        const arrayBuffer = ByteArray3DModel instanceof Uint8Array
            ? ByteArray3DModel.buffer
            : new Uint8Array(ByteArray3DModel).buffer;
        const blob = new Blob([arrayBuffer], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const loader = new OBJLoader();

        loader.load(
            url,
            (object) => {
                // Remove previous objects
                for (let i = this.objectsGroup.children.length - 1; i >= 0; --i)
                    this.objectsGroup.remove(this.objectsGroup.children[i]);

                // Add loaded object
                this.objectsGroup.add(object);

                // Attach transform controls to the new object
                this.transformControls.detach(); // Detach from any previous object
                this.transformControls.attach(object);

                URL.revokeObjectURL(url);
            },
            undefined,
            (error) => {
                console.error('Error loading OBJ model:', error);
                URL.revokeObjectURL(url);
            }
        );
    }

    async load3dModelSimplifyTest() {
        // Show GUI if not shown already
        if (gui && gui.domElement && gui.domElement.style.display === 'none') {
            gui.domElement.style.display = '';
        }

        gui.onChange(app.simplifyTest);

        // Remove previous objects
        for (let i = this.objectsGroup.children.length - 1; i >= 0; --i)
            this.objectsGroup.remove(this.objectsGroup.children[i]);

        // geometry
        this.srcGeometry = new THREE.TorusKnotGeometry(5, 2.5, 124, 32);
        this.dstGeometry = this.srcGeometry.clone();

        // mesh
        let mesh = new THREE.Mesh(this.dstGeometry, new THREE.MeshBasicMaterial({ wireframe: true }));
        this.objectsGroup.add(mesh);
    }

    async load3dModelSimplify(ByteArray3DModel) {
        // Show GUI if not shown already
        if (gui && gui.domElement && gui.domElement.style.display === 'none') {
            gui.domElement.style.display = '';
        }

        gui.onChange(app.simplify);

        // Convert the incoming .NET byte[] to a Blob and then to a URL for OBJLoader
        const arrayBuffer = ByteArray3DModel instanceof Uint8Array
            ? ByteArray3DModel.buffer
            : new Uint8Array(ByteArray3DModel).buffer;
        const blob = new Blob([arrayBuffer], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const loader = new OBJLoader();

        loader.load(
            url,
            (object) => {
                // Remove previous objects
                for (let i = this.objectsGroup.children.length - 1; i >= 0; --i)
                    this.objectsGroup.remove(this.objectsGroup.children[i]);

                let mesh = null;
                let geometry = null;
 
                // Try to find a mesh with geometry in the loaded object
                let meshCounter = 0;
                 object.traverse((child) => {
                     if (child.isMesh && child.geometry) {
                         // Ensure geometry is indexed
                         if (!child.geometry.index) {
                             child.geometry = BufferGeometryUtils.mergeVertices(child.geometry);
                         }

                         // Store geometries in lists by meshCounter
                         this.srcGeometryList[meshCounter] = child.geometry;
                         this.dstGeometryList[meshCounter] = child.geometry.clone();

                         // mesh
                         mesh = new THREE.Mesh(this.dstGeometryList[meshCounter], new THREE.MeshBasicMaterial({ wireframe: true }));
                         this.objectsGroup.add(mesh);

                         meshCounter++;
                     }
                 });

                // Attach transform controls to the new object
                this.transformControls.detach(); // Detach from any previous object
                this.transformControls.attach(object);
                this.transformControls.setMode('rotate');

                URL.revokeObjectURL(url);
            },
            undefined,
            (error) => {
                console.error('Error loading OBJ model:', error);
                URL.revokeObjectURL(url);
            }
        );
    }

    async load3dModelNew(ByteArray3DModel) {
        // Hide GUI if not hidden already
        if (gui && gui.domElement && gui.domElement.style.display !== 'none') {
            gui.domElement.style.display = 'none';
        }

        // Convert the incoming .NET byte[] to a Blob and then to a URL for OBJLoader
        const arrayBuffer = ByteArray3DModel instanceof Uint8Array
            ? ByteArray3DModel.buffer
            : new Uint8Array(ByteArray3DModel).buffer;
        const blob = new Blob([arrayBuffer], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);

        const loader = new OBJLoader();

        loader.load(
            url,
            (object) => {
                // Remove previous objects
                for (let i = this.objectsGroup.children.length - 1; i >= 0; --i)
                    this.objectsGroup.remove(this.objectsGroup.children[i]);
                // Add loaded object
                this.objectsGroup.add(object);

                // Attach transform controls to the new object
                this.transformControls.detach(); // Detach from any previous object
                this.transformControls.attach(object);

                URL.revokeObjectURL(url);
            },
            undefined,
            (error) => {
                console.error('Error loading OBJ model:', error);
                URL.revokeObjectURL(url);
            }
        );

        /*loader.load(
            url,
            async (object) => {
                // Remove previous
                this.objectsGroup.clear();

                // Init meshoptimizer (needed before first call)
                //await meshopt.ready;

                object.traverse((child) => {
                    if (child.isMesh) {
                        let geometry = child.geometry;

                        // Ensure indexed geometry
                        if (!geometry.index) {
                            geometry = BufferGeometryUtils.mergeVertices(geometry);
                        }

                        const indices = new Uint32Array(geometry.index.array);
                        const vertices = new Float32Array(geometry.attributes.position.array);

                        const targetIndexCount = Math.floor(indices.length * 0.5); // keep 50%

                        // meshoptimizer returns [newIndexArray, newIndexCount]
                        const [simplifiedIndices, newCount] = MeshoptSimplifier.simplify(
                            indices,
                            vertices,
                            3,          // stride = 3 floats (x,y,z) * 4 bytes
                            targetIndexCount,
                            0.02            // error tolerance (smaller = higher quality)
                        );

                        // Build new BufferGeometry
                        const simplified = new THREE.BufferGeometry();
                        simplified.setAttribute('position', geometry.attributes.position);
                        if (geometry.attributes.normal) simplified.setAttribute('normal', geometry.attributes.normal);
                        if (geometry.attributes.uv) simplified.setAttribute('uv', geometry.attributes.uv);
                        simplified.setIndex(new THREE.BufferAttribute(simplifiedIndices.subarray(0, newCount), 1));

                        simplified.computeVertexNormals();

                        child.geometry = simplified;
                        child.material = new THREE.MeshStandardMaterial({
                            color: 0x6699ff,
                            flatShading: true
                        });
                    }
                });

                const simplifiedGroup = new THREE.Group();
                simplifiedGroup.add(object);
                this.objectsGroup.add(object);

                this.transformControls.detach();
                this.transformControls.attach(simplifiedGroup);

                URL.revokeObjectURL(url);
            },
            undefined,
            (error) => {
                console.error('Error loading OBJ model:', error);
                URL.revokeObjectURL(url);
            }
        );*/
    }

    /////////////////////////////////////////////////////////



    //Other//////////////////////////////////////////////////

    cinematicView(cinematicViewToggleInterOp) {
        this.cinematicViewToggle = cinematicViewToggleInterOp;

        // Compute the bounding box of the group
        const bbox = new THREE.Box3().setFromObject(this.objectsGroup);

        // Calculate the center point of the bounding box
        bbox.getCenter(this.cinematicSettings.chipCenterPoint);
    }

    onWindowResize() {
        const width = this.settings.containerElement.innerWidth;
        const height = this.settings.containerElement.innerHeight;

        //Update the renderer size and aspect ratio.
        this.renderer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    changeBackground(backgroundName) {
        if (!backgroundName || backgroundName.toLowerCase() === "none") {
            this.scene.background = null;
            return;
        }

        const texture = this.textureLoader.load(window.location.href + '/resources/images/background/' + backgroundName, () => {
            const rt = new THREE.WebGLCubeRenderTarget(texture.image.height);
            rt.fromEquirectangularTexture(this.renderer, texture);
            this.scene.background = rt.texture;
        });
    }

    download3DModel(fileName, fileType) {
        let exporter;
        let data;

        switch (fileType) {
            case ".stl":
                exporter = new STLExporter();
                data = exporter.parse(this.scene);
                BlazorDownloadFile(fileName + '.stl', 'application/octet-stream', data);
                break;
            case ".obj":
                exporter = new OBJExporter();
                data = exporter.parse(this.scene);
                BlazorDownloadFile(fileName + '.obj', 'application/octet-stream', data);
                break
            case ".gltf":
                exporter = new GLTFExporter();
                exporter.parse(this.scene, function (gltf) {
                    data = JSON.stringify(gltf, null, 2);
                    BlazorDownloadFile(fileName + '.gltf', 'application/octet-stream', data);
                });
                break;
        }
    }

    /////////////////////////////////////////////////////////
}