import { AfterViewInit, Component, ElementRef, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import * as THREE from 'three';

@Component({
  selector: 'app-three-pack-scene',
  template: '<canvas #canvas aria-label="סצנת תלת ממד של חבילה וקלף"></canvas>',
  styles: [`
    :host {
      display: block;
      width: 100%;
      min-height: 270px;
      border-radius: 12px;
      overflow: hidden;
      background: radial-gradient(circle at 50% 22%, rgba(255, 213, 95, .22), transparent 15rem), #142037;
    }

    canvas {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 270px;
      touch-action: manipulation;
    }

    @media (max-width: 480px) {
      :host,
      canvas {
        min-height: 230px;
      }
    }
  `]
})
export class ThreePackSceneComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() packImage = '';
  @Input() cardImage = '';
  @Input() opened = false;

  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;

  private renderer?: THREE.WebGLRenderer;
  private scene?: THREE.Scene;
  private camera?: THREE.PerspectiveCamera;
  private packMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private cardMesh?: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private resizeObserver?: ResizeObserver;
  private animationFrame = 0;
  private readonly loader = new THREE.TextureLoader();

  ngAfterViewInit(): void {
    this.createScene();
    this.loadTextures();
    this.animate();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.scene) return;
    if (changes['packImage'] || changes['cardImage']) this.loadTextures();
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.animationFrame);
    this.resizeObserver?.disconnect();
    this.packMesh?.material.map?.dispose();
    this.cardMesh?.material.map?.dispose();
    this.packMesh?.geometry.dispose();
    this.cardMesh?.geometry.dispose();
    this.packMesh?.material.dispose();
    this.cardMesh?.material.dispose();
    this.renderer?.dispose();
  }

  private createScene(): void {
    const canvas = this.canvasRef.nativeElement;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.camera.position.set(0, 0, 6.4);

    const ambient = new THREE.AmbientLight(0xffffff, 1.7);
    this.scene.add(ambient);

    const packMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    const cardMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.packMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.82, 3.95), packMaterial);
    this.cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.08), cardMaterial);

    this.packMesh.position.set(0.62, 0.04, 0);
    this.packMesh.rotation.z = -0.08;
    this.cardMesh.position.set(-0.86, -0.34, .12);
    this.cardMesh.rotation.z = 0.14;

    this.scene.add(this.packMesh, this.cardMesh);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    this.resize();
  }

  private loadTextures(): void {
    if (this.packImage && this.packMesh) {
      this.loader.load(this.packImage, (texture) => {
        const cleanTexture = this.removeEdgeBackground(texture);
        this.packMesh?.material.map?.dispose();
        this.packMesh!.material.map = cleanTexture;
        this.packMesh!.material.alphaTest = 0.02;
        this.packMesh!.material.needsUpdate = true;
      });
    }

    if (this.cardImage && this.cardMesh) {
      this.loader.load(this.cardImage, (texture) => {
        const cleanTexture = this.removeEdgeBackground(texture);
        this.cardMesh?.material.map?.dispose();
        this.cardMesh!.material.map = cleanTexture;
        this.cardMesh!.material.alphaTest = 0.02;
        this.cardMesh!.material.needsUpdate = true;
      });
    }
  }

  private removeEdgeBackground(texture: THREE.Texture): THREE.Texture {
    const image = texture.image as CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number; height?: number };
    const width = image.naturalWidth || image.width || 0;
    const height = image.naturalHeight || image.height || 0;
    if (!width || !height) {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      texture.colorSpace = THREE.SRGBColorSpace;
      return texture;
    }

    context.drawImage(image, 0, 0, width, height);
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const seen = new Uint8Array(width * height);
    const queue: number[] = [];

    const cornerSamples = [
      0,
      width - 1,
      (height - 1) * width,
      (height - 1) * width + width - 1,
    ];
    const cornerColor = cornerSamples.reduce(
      (sum, pixel) => {
        const offset = pixel * 4;
        return {
          red: sum.red + data[offset],
          green: sum.green + data[offset + 1],
          blue: sum.blue + data[offset + 2],
        };
      },
      { red: 0, green: 0, blue: 0 },
    );
    cornerColor.red /= cornerSamples.length;
    cornerColor.green /= cornerSamples.length;
    cornerColor.blue /= cornerSamples.length;

    const isEdgeBackground = (pixel: number): boolean => {
      const offset = pixel * 4;
      const red = data[offset];
      const green = data[offset + 1];
      const blue = data[offset + 2];
      const alpha = data[offset + 3];
      const channelSpread = Math.max(red, green, blue) - Math.min(red, green, blue);
      const lightNeutral = red >= 228 && green >= 224 && blue >= 216 && channelSpread < 34;
      const cornerDistance = Math.abs(red - cornerColor.red) + Math.abs(green - cornerColor.green) + Math.abs(blue - cornerColor.blue);
      return alpha < 12 || (lightNeutral && cornerDistance < 58);
    };

    const push = (x: number, y: number): void => {
      if (x < 0 || y < 0 || x >= width || y >= height) return;
      const pixel = y * width + x;
      if (seen[pixel] || !isEdgeBackground(pixel)) return;
      seen[pixel] = 1;
      queue.push(pixel);
    };

    for (let x = 0; x < width; x += 1) {
      push(x, 0);
      push(x, height - 1);
    }
    for (let y = 0; y < height; y += 1) {
      push(0, y);
      push(width - 1, y);
    }

    for (let head = 0; head < queue.length; head += 1) {
      const pixel = queue[head];
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      data[pixel * 4 + 3] = 0;
      push(x + 1, y);
      push(x - 1, y);
      push(x, y + 1);
      push(x, y - 1);
    }

    context.putImageData(imageData, 0, 0);
    texture.dispose();
    const cleanTexture = new THREE.CanvasTexture(canvas);
    cleanTexture.colorSpace = THREE.SRGBColorSpace;
    cleanTexture.needsUpdate = true;
    return cleanTexture;
  }

  private resize(): void {
    if (!this.renderer || !this.camera) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private animate = (): void => {
    this.animationFrame = requestAnimationFrame(this.animate);
    if (!this.renderer || !this.scene || !this.camera) return;

    const time = performance.now() * 0.001;
    if (this.packMesh) {
      this.packMesh.rotation.y = Math.sin(time * 0.9) * 0.13;
      this.packMesh.rotation.z = this.opened ? -0.22 + Math.sin(time * 1.6) * 0.025 : -0.08 + Math.sin(time) * 0.018;
      this.packMesh.position.y = Math.sin(time * 1.4) * 0.04;
    }
    if (this.cardMesh) {
      this.cardMesh.rotation.y = Math.sin(time * 1.15 + 1.2) * 0.12;
      this.cardMesh.position.y = -0.35 + Math.sin(time * 1.8) * 0.05;
      this.cardMesh.position.x = this.opened ? -1.0 : -0.72;
    }

    this.renderer.render(this.scene, this.camera);
  };
}
