#!/usr/bin/env node

/**
 * Sentinel Educational Platform for DeFi Security
 * Learning platform with courses, certifications, and security training
 */

const express = require('express');
const fs = require('fs');
const path = require('path');

/**
 * Educational Platform Server
 */
class SentinelEducationPlatform {
  constructor(port = 3001) {
    this.app = express();
    this.port = port;
    this.coursesPath = './education-courses';
    this.certificatesPath = './education-certificates';
    this.ensureDirectories();

    this.setupMiddleware();
    this.setupRoutes();
  }

  ensureDirectories() {
    const dirs = [
      this.coursesPath,
      this.certificatesPath,
      `${this.coursesPath}/beginner`,
      `${this.coursesPath}/intermediate`,
      `${this.coursesPath}/advanced`,
      `${this.certificatesPath}/issued`,
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  setupMiddleware() {
    this.app.use(express.json());
    this.app.use(express.static('public'));
    this.app.use('/education', express.static(this.coursesPath));
  }

  setupRoutes() {
    // Get all courses
    this.app.get('/api/courses', (req, res) => {
      const courses = this.getAllCourses();
      res.json(courses);
    });

    // Get specific course
    this.app.get('/api/courses/:courseId', (req, res) => {
      const course = this.getCourse(req.params.courseId);
      if (course) {
        res.json(course);
      } else {
        res.status(404).json({ error: 'Course not found' });
      }
    });

    // Complete course module
    this.app.post('/api/courses/:courseId/modules/:moduleId/complete', (req, res) => {
      const { userAddress, score } = req.body;
      const completion = this.recordModuleCompletion(
        req.params.courseId,
        req.params.moduleId,
        userAddress,
        score
      );
      res.json(completion);
    });

    // Issue certificate
    this.app.post('/api/certificates/issue', (req, res) => {
      const { userAddress, courseId, finalScore } = req.body;
      const certificate = this.issueCertificate(userAddress, courseId, finalScore);
      res.json(certificate);
    });

    // Verify certificate
    this.app.get('/api/certificates/verify/:certificateId', (req, res) => {
      const certificate = this.verifyCertificate(req.params.certificateId);
      if (certificate) {
        res.json(certificate);
      } else {
        res.status(404).json({ error: 'Certificate not found' });
      }
    });

    // Get user progress
    this.app.get('/api/users/:userAddress/progress', (req, res) => {
      const progress = this.getUserProgress(req.params.userAddress);
      res.json(progress);
    });

    // Security quiz API
    this.app.post('/api/quizzes/:quizId/submit', (req, res) => {
      const { userAddress, answers } = req.body;
      const result = this.gradeQuiz(req.params.quizId, userAddress, answers);
      res.json(result);
    });
  }

  /**
   * Create a new course
   */
  createCourse(courseData) {
    const courseId = `course-${Date.now()}`;
    const coursePath = path.join(
      this.coursesPath,
      courseData.level || 'beginner',
      `${courseId}.json`
    );

    const course = {
      id: courseId,
      title: courseData.title,
      description: courseData.description,
      level: courseData.level || 'beginner',
      duration: courseData.duration || '2 hours',
      prerequisites: courseData.prerequisites || [],
      modules: courseData.modules || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    fs.writeFileSync(coursePath, JSON.stringify(course, null, 2));
    console.log(`Course created: ${courseId}`);

    return course;
  }

  /**
   * Get all courses
   */
  getAllCourses() {
    const courses = [];
    const levels = ['beginner', 'intermediate', 'advanced'];

    levels.forEach(level => {
      const levelPath = path.join(this.coursesPath, level);
      if (fs.existsSync(levelPath)) {
        const files = fs.readdirSync(levelPath);
        files.forEach(file => {
          if (file.endsWith('.json')) {
            const courseData = JSON.parse(fs.readFileSync(path.join(levelPath, file), 'utf8'));
            courses.push(courseData);
          }
        });
      }
    });

    return courses;
  }

  /**
   * Get specific course
   */
  getCourse(courseId) {
    const levels = ['beginner', 'intermediate', 'advanced'];

    for (const level of levels) {
      const coursePath = path.join(this.coursesPath, level, `${courseId}.json`);
      if (fs.existsSync(coursePath)) {
        return JSON.parse(fs.readFileSync(coursePath, 'utf8'));
      }
    }

    return null;
  }

  /**
   * Record module completion
   */
  recordModuleCompletion(courseId, moduleId, userAddress, score) {
    const progressPath = path.join(this.certificatesPath, 'progress', `${userAddress}.json`);

    let progress = { userAddress, completedModules: {} };
    if (fs.existsSync(progressPath)) {
      progress = JSON.parse(fs.readFileSync(progressPath, 'utf8'));
    }

    if (!progress.completedModules[courseId]) {
      progress.completedModules[courseId] = {};
    }

    progress.completedModules[courseId][moduleId] = {
      completedAt: new Date().toISOString(),
      score: score,
    };

    fs.writeFileSync(progressPath, JSON.stringify(progress, null, 2));

    return progress.completedModules[courseId][moduleId];
  }

  /**
   * Issue certificate
   */
  issueCertificate(userAddress, courseId, finalScore) {
    const certificateId = `cert-${Date.now()}`;
    const certificatePath = path.join(this.certificatesPath, 'issued', `${certificateId}.json`);

    const certificate = {
      id: certificateId,
      userAddress,
      courseId,
      courseTitle: this.getCourse(courseId)?.title || 'Unknown Course',
      finalScore,
      issuedAt: new Date().toISOString(),
      expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(), // 1 year
      issuer: 'Sentinel Security Education Platform',
      signature: this.generateCertificateSignature(certificateId, userAddress),
    };

    fs.writeFileSync(certificatePath, JSON.stringify(certificate, null, 2));

    return certificate;
  }

  /**
   * Verify certificate
   */
  verifyCertificate(certificateId) {
    const certificatePath = path.join(this.certificatesPath, 'issued', `${certificateId}.json`);

    if (!fs.existsSync(certificatePath)) {
      return null;
    }

    return JSON.parse(fs.readFileSync(certificatePath, 'utf8'));
  }

  /**
   * Get user progress
   */
  getUserProgress(userAddress) {
    const progressPath = path.join(this.certificatesPath, 'progress', `${userAddress}.json`);

    if (!fs.existsSync(progressPath)) {
      return { userAddress, completedModules: {} };
    }

    return JSON.parse(fs.readFileSync(progressPath, 'utf8'));
  }

  /**
   * Grade quiz
   */
  gradeQuiz(quizId, userAddress, answers) {
    // This would load quiz questions and grade answers
    // For now, return mock result
    const score = Math.floor(Math.random() * 40) + 60; // 60-100%

    return {
      quizId,
      userAddress,
      score,
      passed: score >= 70,
      feedback: score >= 90 ? 'Excellent!' : score >= 70 ? 'Good job!' : 'Keep studying!',
    };
  }

  /**
   * Generate certificate signature (simplified)
   */
  generateCertificateSignature(certificateId, userAddress) {
    // In production, this would be a cryptographic signature
    return `sig-${certificateId}-${userAddress}`;
  }

  /**
   * Start the education platform server
   */
  start() {
    this.app.listen(this.port, () => {
      console.log(`Sentinel Education Platform running on port ${this.port}`);
      console.log(`API available at http://localhost:${this.port}/api`);
    });
  }
}

// Example usage
if (require.main === module) {
  const platform = new SentinelEducationPlatform();

  // Create sample courses
  platform.createCourse({
    title: 'DeFi Security Fundamentals',
    description: 'Learn the basics of DeFi security, common vulnerabilities, and best practices',
    level: 'beginner',
    duration: '4 hours',
    modules: [
      {
        id: 'module-1',
        title: 'Introduction to DeFi Security',
        content: 'Understanding DeFi risks and attack vectors...',
        quiz: {
          questions: [
            {
              question: 'What is a flash loan attack?',
              options: ['A', 'B', 'C', 'D'],
              correctAnswer: 0,
            },
          ],
        },
      },
    ],
  });

  console.log('Sample courses created. Starting server...');
  platform.start();
}

module.exports = SentinelEducationPlatform;
