// Sentinel L3 - Interactive Quantum Interface
// Advanced JavaScript for the most sophisticated DeFi security platform

class SentinelInterface {
  constructor() {
    this.init();
    this.setupEventListeners();
    this.initializeQuantumCore();
    this.renderTelemetry();
    this.startAnimations();
  }

  init() {
    this.navbar = document.querySelector('.navbar');
    this.heroSection = document.querySelector('#home');
    this.sections = document.querySelectorAll('section');
    this.navLinks = document.querySelectorAll('.nav-link');

    // Performance metrics display
    this.metricsInterval = null;
    this.quantumParticles = [];
  }

  setupEventListeners() {
    // Smooth scrolling navigation
    this.navLinks.forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const targetId = link.getAttribute('href');
        const targetSection = document.querySelector(targetId);

        if (targetSection) {
          const offsetTop = targetSection.offsetTop - 80;
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth',
          });
        }
      });
    });

    // Navbar scroll effect
    window.addEventListener('scroll', () => {
      if (window.scrollY > 100) {
        this.navbar.classList.add('scrolled');
      } else {
        this.navbar.classList.remove('scrolled');
      }

      // Update active nav link
      this.updateActiveNavLink();
    });

    // Hero buttons
    const launchBtn = document.querySelector('.btn-primary-large');
    const demoBtn = document.querySelector('.btn-secondary-large');
    const navLaunchBtn = document.getElementById('nav-launch-btn');

    launchBtn?.addEventListener('click', () => this.launchSentinel());
    demoBtn?.addEventListener('click', () => this.showDemo());
    navLaunchBtn?.addEventListener('click', () => this.launchSentinel());

    // Newsletter form
    const newsletterForm = document.querySelector('.newsletter-form');
    newsletterForm?.addEventListener('submit', (e) => {
      e.preventDefault();
      this.subscribeNewsletter();
    });

    // Animate elements on scroll
    this.setupScrollAnimations();
  }

  initializeQuantumCore() {
    // Initialize Three.js quantum core visualization
    if (typeof THREE !== 'undefined') {
      this.initQuantumVisualization();
    }

    // Start real-time metrics updates
    this.startMetricsUpdates();

    // Initialize quantum particle system
    this.createQuantumParticles();
  }

  initQuantumVisualization() {
    const container = document.getElementById('sentinel-core');
    if (!container) return;

    // Three.js scene setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      1000,
    );
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setClearColor(0x000000, 0);
    container.appendChild(this.renderer.domElement);

    // Create quantum core geometry
    this.createQuantumCore();

    // Position camera
    this.camera.position.z = 5;

    // Start render loop
    this.animateQuantumCore();

    // Handle resize
    window.addEventListener('resize', () => {
      this.camera.aspect = container.clientWidth / container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(container.clientWidth, container.clientHeight);
    });
  }

  createQuantumCore() {
    // Central quantum core
    const coreGeometry = new THREE.IcosahedronGeometry(1, 0);
    const coreMaterial = new THREE.MeshPhongMaterial({
      color: 0x00ffff,
      emissive: 0x002222,
      transparent: true,
      opacity: 0.8,
    });
    this.quantumCore = new THREE.Mesh(coreGeometry, coreMaterial);
    this.scene.add(this.quantumCore);

    // Orbital rings
    for (let i = 0; i < 3; i++) {
      const ringGeometry = new THREE.TorusGeometry(1.5 + i * 0.5, 0.02, 8, 64);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: i === 0 ? 0xff00ff : i === 1 ? 0x00ff88 : 0xff6b00,
        transparent: true,
        opacity: 0.6,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.rotation.x = Math.PI / 2;
      this.scene.add(ring);
    }

    // Quantum particles
    this.particleSystem = this.createParticleSystem();
    this.scene.add(this.particleSystem);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(10, 10, 10);
    this.scene.add(pointLight);
  }

  createParticleSystem() {
    const particleCount = 1000;
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const colorPalette = [
      new THREE.Color(0x00ffff), // Cyan
      new THREE.Color(0xff00ff), // Magenta
      new THREE.Color(0x00ff88), // Green
      new THREE.Color(0xff6b00), // Orange
    ];

    for (let i = 0; i < particleCount; i++) {
      // Spherical distribution
      const radius = Math.random() * 3 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = radius * Math.cos(phi);

      // Random color from palette
      const color =
        colorPalette[Math.floor(Math.random() * colorPalette.length)];
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.PointsMaterial({
      size: 0.02,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    return new THREE.Points(geometry, material);
  }

  animateQuantumCore() {
    if (!this.renderer) return;

    requestAnimationFrame(() => this.animateQuantumCore());

    const time = Date.now() * 0.001;

    // Rotate quantum core
    if (this.quantumCore) {
      this.quantumCore.rotation.x += 0.01;
      this.quantumCore.rotation.y += 0.015;
    }

    // Animate orbital rings
    this.scene.children.forEach((child, index) => {
      if (child.geometry && child.geometry.type === 'TorusGeometry') {
        child.rotation.z += 0.005 * (index + 1);
      }
    });

    // Animate particles
    if (this.particleSystem) {
      const positions = this.particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < positions.length; i += 3) {
        // Create quantum tunneling effect
        positions[i] += Math.sin(time + i * 0.01) * 0.001;
        positions[i + 1] += Math.cos(time + i * 0.01) * 0.001;
        positions[i + 2] += Math.sin(time * 0.5 + i * 0.01) * 0.001;
      }
      this.particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    this.renderer.render(this.scene, this.camera);
  }

  startMetricsUpdates() {
    // Simulate real-time metrics updates
    this.metricsInterval = setInterval(() => {
      this.updateLiveMetrics();
    }, 5000);
  }

  updateLiveMetrics() {
    const metrics = document.querySelectorAll('.metric-value');

    if (metrics.length >= 4) {
      // Simulate increasing TVL
      const currentTVL = metrics[0].textContent;
      if (currentTVL && currentTVL.includes('B')) {
        const baseValue = parseFloat(
          currentTVL.replace('$', '').replace('B+', ''),
        );
        const newValue = (baseValue + Math.random() * 0.1).toFixed(1);
        metrics[0].textContent = `$${newValue}B+`;
      }

      // Update APY with quantum fluctuations
      const apyValues = ['3.0', '3.5', '4.0', '4.5', '5.0'];
      const randomAPY = apyValues[Math.floor(Math.random() * apyValues.length)];
      metrics[1].textContent = `${randomAPY}%`;

      // Update TPS
      const currentTPS = parseInt(metrics[2].textContent.replace(',', ''));
      const newTPS = currentTPS + Math.floor(Math.random() * 100) - 50;
      metrics[2].textContent = Math.max(1000, newTPS).toLocaleString();
    }
  }

  createQuantumParticles() {
    // Create floating quantum particles in background
    for (let i = 0; i < 50; i++) {
      const particle = document.createElement('div');
      particle.className = 'quantum-particle';
      particle.style.cssText = `
                position: absolute;
                width: 2px;
                height: 2px;
                background: ${
                  ['#00ffff', '#ff00ff', '#00ff88'][
                    Math.floor(Math.random() * 3)
                  ]
                };
                border-radius: 50%;
                pointer-events: none;
                animation: float ${Math.random() * 10 + 10}s linear infinite;
                left: ${Math.random() * 100}%;
                top: ${Math.random() * 100}%;
                opacity: ${Math.random() * 0.5 + 0.2};
            `;

      document.body.appendChild(particle);
      this.quantumParticles.push(particle);
    }
  }

  setupScrollAnimations() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in-up');
        }
      });
    }, observerOptions);

    // Observe all sections and cards
    document
      .querySelectorAll(
        'section, .lore-card, .tech-card, .security-feature, .yield-tier, .component',
      )
      .forEach((el) => {
        observer.observe(el);
      });
  }

  updateActiveNavLink() {
    const scrollPosition = window.scrollY + 100;

    this.sections.forEach((section) => {
      const sectionTop = section.offsetTop - 80;
      const sectionBottom = sectionTop + section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        this.navLinks.forEach((link) => {
          link.classList.remove('active');
          if (link.getAttribute('href') === `#${sectionId}`) {
            link.classList.add('active');
          }
        });
      }
    });
  }

  launchSentinel() {
    const contracts = window.SENTINEL_CONTRACTS || {};
    const network = window.SENTINEL_NETWORK || 'unknown';
    const bridgeAddr =
      contracts.AetheronBridge && contracts.AetheronBridge.address;
    const bridgeUrl =
      contracts.AetheronBridge && contracts.AetheronBridge.explorerUrl;

    if (bridgeAddr) {
      // Open Etherscan for the bridge contract in a new tab
      window.open(bridgeUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Not yet deployed — show informational modal instead of alert
      const modal = document.createElement('div');
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      modal.innerHTML = `
                <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;">
                    <div style="text-align:center;max-width:520px;padding:40px;background:#0a0a1a;border:1px solid #00ffff44;border-radius:12px;">
                        <h2 style="color:#00ffff;margin-bottom:16px;">Sentinel L3</h2>
                        <p style="color:#ccc;margin-bottom:8px;line-height:1.6;">
                            Contracts are not yet deployed on <strong style="color:#fff">${network}</strong>.
                        </p>
                        <p style="color:#888;font-size:0.85rem;margin-bottom:24px;">
                            Run <code style="color:#00ff88">npm run deploy:testnet</code> then <code style="color:#00ff88">npm run export:site-config</code> to connect the UI.
                        </p>
                        <button onclick="this.closest('[role=dialog]').remove()" style="padding:10px 24px;background:#00ffff;color:#000;border:none;border-radius:6px;cursor:pointer;font-weight:bold;">Close</button>
                    </div>
                </div>
            `;
      document.body.appendChild(modal);
    }
  }

  showDemo() {
    // Show interactive demo
    const demoModal = document.createElement('div');
    demoModal.innerHTML = `
            <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.9); z-index: 10000; display: flex; align-items: center; justify-content: center; color: white;">
                <div style="text-align: center; max-width: 600px; padding: 40px;">
                    <h2 style="color: #00ffff; margin-bottom: 20px;">Sentinel Core Loop Demo</h2>
                    <p style="margin-bottom: 30px; line-height: 1.6;">
                        Experience the power of quantum-resistant DeFi security.
                        The Sentinel Core Loop is now analyzing your transactions in real-time.
                    </p>
                    <div style="display: flex; gap: 20px; justify-content: center;">
                        <button onclick="this.parentElement.parentElement.parentElement.remove()" style="padding: 10px 20px; background: #00ffff; border: none; border-radius: 5px; cursor: pointer;">Close Demo</button>
                    </div>
                </div>
            </div>
        `;
    document.body.appendChild(demoModal);
  }

  subscribeNewsletter() {
    const email = document.querySelector('.newsletter-form input').value;
    if (email) {
      alert(
        `📧 Thank you for joining the Sentinel network!\n\nWe'll send quantum-secured updates to: ${email}\n\n🔐 Your subscription is protected by post-quantum cryptography.`,
      );
      document.querySelector('.newsletter-form input').value = '';
    }
  }

  startAnimations() {
    // Add CSS animations to elements
    document
      .querySelectorAll('.tech-card, .lore-card, .security-feature')
      .forEach((card, index) => {
        card.style.animationDelay = `${index * 0.1}s`;
      });
  }

  renderTelemetry() {
    const telemetry = window.SENTINEL_PHASE_A;
    if (!telemetry) return;

    this.renderAnomalies(telemetry.anomalies || []);
    this.renderWatchpoints(telemetry.watchpoints || []);
    this.renderVerdicts(telemetry.verdicts || []);
  }

  renderAnomalies(items) {
    const container = document.getElementById('anomalies-feed');
    if (!container) return;

    container.innerHTML = items
      .slice(0, 6)
      .map(
        (item) => `
          <div class="telemetry-item">
            <div class="telemetry-row">
              <span class="telemetry-severity telemetry-${item.severity}">${item.severity.toUpperCase()}</span>
              <span class="telemetry-time">${new Date(item.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="telemetry-message">${item.message}</div>
            <div class="telemetry-source">${item.source}</div>
          </div>
        `,
      )
      .join('');
  }

  renderWatchpoints(items) {
    const container = document.getElementById('watchpoints-feed');
    if (!container) return;

    container.innerHTML = items
      .slice(0, 6)
      .map((item) => {
        const last = item.trend[item.trend.length - 1];
        const prev = item.trend[item.trend.length - 2] || last;
        const delta = last - prev;
        const deltaText = `${delta >= 0 ? '+' : ''}${delta}`;
        return `
          <div class="telemetry-item">
            <div class="telemetry-row">
              <span class="telemetry-label">${item.label}</span>
              <span class="telemetry-status telemetry-${item.status}">${item.status.toUpperCase()}</span>
            </div>
            <div class="telemetry-delta">Delta: ${deltaText}</div>
          </div>
        `;
      })
      .join('');
  }

  renderVerdicts(items) {
    const container = document.getElementById('verdicts-feed');
    if (!container) return;

    container.innerHTML = items
      .slice(0, 6)
      .map(
        (item) => `
          <div class="telemetry-item">
            <div class="telemetry-row">
              <span class="telemetry-label">${item.message}</span>
              <span class="telemetry-status telemetry-${item.status}">${item.status.toUpperCase()}</span>
            </div>
            <div class="telemetry-source">Block ${item.block}</div>
          </div>
        `,
      )
      .join('');
  }
}

// Initialize Sentinel Interface
document.addEventListener('DOMContentLoaded', () => {
  new SentinelInterface();
});

// Add CSS for quantum particles
const particleStyles = `
    @keyframes float {
        0% { transform: translateY(0px) translateX(0px) rotate(0deg); }
        33% { transform: translateY(-20px) translateX(10px) rotate(120deg); }
        66% { transform: translateY(-10px) translateX(-10px) rotate(240deg); }
        100% { transform: translateY(0px) translateX(0px) rotate(360deg); }
    }

    .quantum-particle {
        animation: float linear infinite;
    }
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = particleStyles;
document.head.appendChild(styleSheet);

// Export for potential module usage
window.SentinelInterface = SentinelInterface;
