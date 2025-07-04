import { createScene } from './environment.js';
import { Agent } from './agent.js';
import * as THREE from 'three';
import * as PHYSICS from 'physics';

let agents = [];
const COUNT = 50;
const RADIUS = 1;
const MAXSPEED = 7.5;
const HORIZON = 100;

let performer = new THREE.Vector3(0, 2, 45);
let points;
const MINCOMFORT = 10;
const MAXCOMFORT = 25;
const wAgent = 30;
const wPerformer = 80;

let pickableObjects = [];
let selected = null;
let mouse = new THREE.Vector2();
const raycaster = new THREE.Raycaster();

const pedestrianMat = new THREE.MeshLambertMaterial({
    color: 0x00ff00
});
const onlookerMat = new THREE.MeshLambertMaterial({
    color: 0x0000ff
});
const performerMat = new THREE.MeshLambertMaterial({
    color: 0xff0000
});

const agentGeometry = new THREE.CylinderGeometry(RADIUS, 1, 4, 16);

const { renderer, scene, camera } = createScene();
init();
render();

function weightedScore(point, agent, performer) {
    return wAgent * point.distanceTo(agent.position) + wPerformer * point.distanceTo(performer);
}

function generateViewingPosition(agent) {
    return points
        .sort((p1, p2) => weightedScore(p2, agent, performer) - weightedScore(p1, agent, performer))
        .pop();
}

function getPostition() {
    return [Math.random() * 90 - 45, Math.random() * 30 - 15];
}

function getVelocity() {
    let theta = Math.random() * Math.PI * 2;
    let speed = Math.random() * MAXSPEED;

    return [speed * Math.cos(theta), speed * Math.sin(theta)];
}

function init() {
    const streetMaterial = new THREE.MeshPhongMaterial({ color: 0x222222, side: THREE.DoubleSide });
    const streetGeometry = new THREE.PlaneGeometry(100, 30);
    const streetPlane = new THREE.Mesh(streetGeometry, streetMaterial);
    streetPlane.castShadow = true;
    streetPlane.receiveShadow = true;
    streetPlane.rotation.set(Math.PI / 2, 0, 0);
    streetPlane.position.set(0, 0.05, 0);
    scene.add(streetPlane);

    for (let i = 0; i < COUNT; i++) {
        const v = getVelocity();
        const pos = getPostition();
        const k = 1.5 + Math.random() * 1.5;
        const maxSpeed = Math.random() * (MAXSPEED - 5) + 5;
        const maxForce = 30 + Math.random() * 40;

        agents.push(new Agent(
            i,
            pos[0], 2, pos[1],
            v[0], 0, v[1],
            0, 0, 0,
            50 * (Math.random() < 0.5 ? -1 : 1), 2, pos[1],
            RADIUS, maxSpeed, maxForce, HORIZON, k
        ));

        agents[i].setData("isWatching", false);

        const agent = new THREE.Mesh(agentGeometry, pedestrianMat);
        agent.castShadow = true;
        agent.receiveShadow = true;
        agent.userData = {
            "id": i,
        };
        scene.add(agent);
        agents[i].setData("agent", agent);
        pickableObjects.push(agent);
    }

    const agent = new THREE.Mesh(agentGeometry, performerMat);
    agent.castShadow = true;
    agent.receiveShadow = true;
    agent.position.set(performer.x, performer.y, performer.z);
    scene.add(agent);

    const p = new FastPoissonDiskSampling({
        shape: [100, 100],
        radius: 2 * RADIUS,
        tries: 20
    }); 

    points = p.fill();
    points = points.map(([x, z]) => new THREE.Vector3(x - 50, 0, z - 50));
    points = points.filter(p => {
        const d = p.distanceTo(performer);
        return d > MINCOMFORT && d < MAXCOMFORT;
    });

    window.addEventListener("mousedown", mouseDown, false);
}

function mouseDown(event) {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    selected = null;
    const intersects = raycaster.intersectObjects(pickableObjects, false);
    for (let i = 0; i < intersects.length; i++) {
        selected = intersects[i].object.userData.id;
    }
}

function render() {
    renderer.render(scene, camera);
}

function animate() {
    requestAnimationFrame(animate);

    agents.forEach(function(member) {
        if (member.position.x < -50 + RADIUS) { 
            member.position.x = 50 - RADIUS;
            member.position.z *= -1;
        } else if (member.position.x > 50 - RADIUS) {
            member.position.x = -50 + RADIUS;
            member.position.z *= -1;
        }

        if (selected != null && member.id == selected && !member.getData("isWatching")) {
            member.setData("isWatching", true);
            member.target = generateViewingPosition(member);
        }

        if (member.getData("isWatching") && member.position.z > 20) {
            member.horizon = 1;
        }
    });

    agents.forEach(function(member) {
        PHYSICS.update(member, agents);
    });

    agents.forEach(function(member) {
        member.getData("agent").position.copy(member.position);
        member.getData("agent").material = member.getData("isWatching") ? onlookerMat : pedestrianMat;
    });

    renderer.render(scene, camera);
};

animate();