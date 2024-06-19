import * as THREE from 'three';
import Stats from 'three/addons/libs/stats.module.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';
import { GUI } from 'three/addons/libs/lil-gui.module.min.js';

let camera, scene, renderer, stats, object, loader, guiMorphsFolder;
const clock = new THREE.Clock();

let mixer;
let currentAnimation = null;
let animationActions = {};
let activeAction;
let previousAction;

const params = {
    asset: 'Arm Stretching', // Sin movimientos
};

const assets = [
    'Walking Backwards', // Caminar hacia atras
    'Fast Run', // Correr
    'Arm Stretching', // Sin movimientos
    'Flying Back Death', // Choque con un cubo
    'Samba Dancing', // Baile de victoria
    'Falling To Roll', // cae del cubo
    'Jumping' // salta
];

const objects = [];
const keysPressed = {};

init();

function init() {
    const container = document.createElement('div');
    document.body.appendChild(container);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 2000);
    camera.position.set(2400, 300, 0); // Ajusta la posición inicial de la cámara

    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xddcae6);
    scene.fog = new THREE.Fog(0xddcae6, 600, 2000); // Densidad de la niebla

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x838285, 5);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 5);
    dirLight.position.set(0, 500, 100);
    dirLight.castShadow = true;
    dirLight.shadow.camera.top = 180;
    dirLight.shadow.camera.bottom = -100;
    dirLight.shadow.camera.left = -120;
    dirLight.shadow.camera.right = 120;
    scene.add(dirLight);

    // Tamaño del plano
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.MeshPhongMaterial({ color: 0xcc96e3, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const grid = new THREE.GridHelper(4000, 20, 0x0f0a52, 0x000000);
    grid.material.opacity = 1.2;
    grid.material.transparent = true;
    scene.add(grid);

    loader = new FBXLoader();
    assets.forEach(asset => preLoadAsset(asset));
    loadAsset(params.asset);

    // Add random colored cubes
    addRandomCubes();

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 100, 0);
    controls.update();

    window.addEventListener('resize', onWindowResize);

    // stats
    stats = new Stats();
    container.appendChild(stats.dom);

    const gui = new GUI();
    gui.add(params, 'asset', assets).onChange(function (value) {
        loadAsset(value);
    });

    guiMorphsFolder = gui.addFolder('Morphs').hide();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
}

function preLoadAsset(asset) {
    loader.load('models/fbx/' + asset + '.fbx', function (group) {
        animationActions[asset] = group.animations;
    });
}

function loadAsset(asset) {
    if (object) {
        object.traverse(function (child) {
            if (child.material) child.material.dispose();
            if (child.material && child.material.map) child.material.map.dispose();
            if (child.geometry) child.geometry.dispose();
        });

        scene.remove(object);
    }

    loader.load('models/fbx/' + asset + '.fbx', function (group) {
        object = group;

        if (object.animations && object.animations.length) {
            mixer = new THREE.AnimationMixer(object);
            const action = mixer.clipAction(object.animations[0]);
            action.play();
            currentAnimation = action;
        } else {
            mixer = null;
            currentAnimation = null;
        }

        guiMorphsFolder.children.forEach((child) => child.destroy());
        guiMorphsFolder.hide();

        object.traverse(function (child) {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                if (child.morphTargetDictionary) {
                    guiMorphsFolder.show();
                    const meshFolder = guiMorphsFolder.addFolder(child.name || child.uuid);
                    Object.keys(child.morphTargetDictionary).forEach((key) => {
                        meshFolder.add(child.morphTargetInfluences, child.morphTargetDictionary[key], 0, 1, 0.01);
                    });
                }
            }
        });

        // Controla la rotación del muñeco
        object.rotation.y = 3 * Math.PI / 2;
        // Controla la posición del muñeco
        object.position.set(1600, 0, 0);

        scene.add(object);
    });
}

function onKeyDown(event) {
    keysPressed[event.code] = true;
}

function onKeyUp(event) {
    keysPressed[event.code] = false;
}

function updateMovement() {
    if (object && currentAnimation) {
        let moveSpeed = 4;
        if (keysPressed['ArrowUp'] || keysPressed['KeyW']) {
            playAnimation('Fast Run');
            object.position.x -= moveSpeed;
        }
        if (keysPressed['ArrowLeft'] || keysPressed['KeyA']) {
            playAnimation('Fast Run');
            object.position.z += moveSpeed;
        }
        if (keysPressed['ArrowDown'] || keysPressed['KeyS']) {
            playAnimation('Walking Backwards');
            object.position.x += moveSpeed;
        }
        if (keysPressed['ArrowRight'] || keysPressed['KeyD']) {
            playAnimation('Fast Run');
            object.position.z -= moveSpeed;
        }
        if (keysPressed['Space']) {
            playAnimation('Jumping');
        }
		if (keysPressed['KeyZ']) {
            object.position.y -= moveSpeed;
        }
        if (!keysPressed['ArrowUp'] && !keysPressed['KeyW'] &&
            !keysPressed['ArrowLeft'] && !keysPressed['KeyA'] &&
            !keysPressed['ArrowDown'] && !keysPressed['KeyS'] &&
            !keysPressed['ArrowRight'] && !keysPressed['KeyD'] &&
            !keysPressed['Space'] && !keysPressed['KeyZ']) {
            playAnimation('Arm Stretching');
        }

        // Collision detection with cubes
        const characterBox = new THREE.Box3().setFromObject(object);
        for (let i = 0; i < objects.length; i++) {
            const cubeBox = new THREE.Box3().setFromObject(objects[i]);
            if (characterBox.intersectsBox(cubeBox)) {
                // Handle collision, for now we just stop the movement
                object.position.x += keysPressed['ArrowUp'] || keysPressed['KeyW'] ? moveSpeed : 0;
                object.position.z -= keysPressed['ArrowLeft'] || keysPressed['KeyA'] ? moveSpeed : 0;
                object.position.x -= keysPressed['ArrowDown'] || keysPressed['KeyS'] ? moveSpeed : 0;
                object.position.z += keysPressed['ArrowRight'] || keysPressed['KeyD'] ? moveSpeed : 0;
                // You can add more responses like playing a collision animation
                playAnimation('Flying Back Death');
                break;
            }
        }
    }
}

function addRandomCubes() {
    const boxGeometry = new THREE.BoxGeometry(100, 20, 100).toNonIndexed();
    const color = new THREE.Color();

    let position = boxGeometry.attributes.position;
    const colorsBox = [];

    for (let i = 0, l = position.count; i < l; i++) {
        color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
        colorsBox.push(color.r, color.g, color.b);
    }

    boxGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsBox, 3));

    for (let i = 0; i < 500; i++) {
        const boxMaterial = new THREE.MeshPhongMaterial({ specular: 0xffffff, flatShading: true, vertexColors: true });
        boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75);
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        box.position.x = Math.floor(Math.random() * 90 - 20) * 20;
        box.position.y = Math.floor(Math.random() * 90) * 20 + 10;
        box.position.z = Math.floor(Math.random() * 90 - 20) * 20;

        scene.add(box);
        objects.push(box);
    }
}

function playAnimation(name) {
    if (name !== params.asset) {
        if (animationActions[name]) {
            const action = mixer.clipAction(animationActions[name][0]);

            if (activeAction) {
                previousAction = activeAction;
                previousAction.fadeOut(0.5);
            }

            activeAction = action;
            action.reset();
            action.fadeIn(0.5);
            action.play();  

            params.asset = name;

            // Ajuste de la altura del salto
            if (name === 'Jumping') {
                // Inicializa el salto
                jumpStart();
            }
        } else {
            console.warn(`Animation ${name} not pre-loaded.`);
        }
    }
}

let jumpStartTime = 0;
let jumpStartY = 0;
let jumpVelocityY = 0;

function jumpStart() {
    jumpStartTime = Date.now();
    jumpStartY = object.position.y;
    jumpVelocityY = 30; // Velocidad inicial hacia arriba, ajusta según sea necesario
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    const delta = clock.getDelta();

    if (mixer) {
        mixer.update(delta);
    }

    updateMovement();

    // Actualizar el salto
    if (params.asset === 'Jumping') {
        const elapsedTime = Date.now() - jumpStartTime;

        // Ajustar la posición y durante el salto
        object.position.y = jumpStartY + (jumpVelocityY * elapsedTime / 1000) - (9.8 * elapsedTime * elapsedTime / 1000000);

        // Cuando alcanza el suelo
        if (object.position.y <= 0) {
            object.position.y = 0; // Ajusta esta altura según la base de tu escena
            playAnimation('Arm Stretching'); // Vuelve a la animación normal una vez que ha aterrizado
        }
    }

    renderer.render(scene, camera);
    stats.update();
}


