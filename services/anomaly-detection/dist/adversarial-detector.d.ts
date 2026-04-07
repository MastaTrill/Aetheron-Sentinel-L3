import { EventEmitter } from "events";
/**
 * @title AdversarialDetector
 * @notice Adversarial machine learning resilience engine
 *
 * Features:
 * - Detects adversarial attacks against ML models
 * - GAN-based threat simulation
 * - Real-time model robustness validation
 * - Automatic adversarial training feedback loop
 */
export interface AdversarialDetectionResult {
    isAdversarial: boolean;
    confidence: number;
    attackType: string;
    perturbationMagnitude: number;
    adversarialScore: number;
    timestamp: number;
    txHash?: string;
}
export interface ModelRobustnessMetrics {
    cleanAccuracy: number;
    adversarialAccuracy: number;
    robustAccuracy: number;
    attackSuccessRate: number;
    lastValidation: number;
}
export declare const ADVERSARIAL_PATTERNS: {
    readonly FGSM: {
        readonly signature: "0x7a9f3d1c";
        readonly confidence: 0.92;
        readonly description: "Fast Gradient Sign Method attack";
    };
    readonly PGD: {
        readonly signature: "0x5b2e8c7a";
        readonly confidence: 0.95;
        readonly description: "Projected Gradient Descent attack";
    };
    readonly CW: {
        readonly signature: "0x3d1f7a9c";
        readonly confidence: 0.91;
        readonly description: "Carlini-Wagner L2 attack";
    };
    readonly UNIVERSAL: {
        readonly signature: "0x8c7a5b2e";
        readonly confidence: 0.88;
        readonly description: "Universal adversarial perturbation";
    };
};
export declare class AdversarialDetector extends EventEmitter {
    private modelPath;
    private autoencoderPath;
    private model;
    private autoencoder;
    private robustnessMetrics;
    private detectionThreshold;
    private perturbationHistory;
    private maxHistoryLength;
    private isTraining;
    private validationInterval;
    constructor(modelPath?: string, autoencoderPath?: string);
    initialize(): Promise<void>;
    /**
     * @notice Detect adversarial patterns in transaction data
     */
    detectAdversarialPattern(transactionData: number[], txHash?: string): AdversarialDetectionResult;
    /**
     * @notice Batch detect adversarial patterns in multiple transactions
     */
    batchDetectAdversarialPatterns(transactions: number[][], txHashes?: string[]): AdversarialDetectionResult[];
    /**
     * @notice Calculate perturbation magnitude using statistical analysis
     */
    calculatePerturbationMagnitude(transactionData: number[]): number;
    /**
     * @notice Classify attack type from adversarial patterns
     */
    classifyAttackType(transactionData: number[], score: number): string;
    /**
     * @notice Validate model robustness against adversarial attacks
     */
    validateModelRobustness(): Promise<ModelRobustnessMetrics>;
    /**
     * @notice Generate clean transaction examples
     */
    generateCleanExamples(count: number): number[][];
    /**
     * @notice Generate adversarial examples using FGSM
     */
    generateAdversarialExamples(cleanExamples: number[][], epsilon?: number): number[][];
    /**
     * @notice Retrain model with adversarial examples (active defense)
     */
    adversarialTraining(epochs?: number): Promise<void>;
    /**
     * @notice Hash transaction data for pattern matching
     */
    private hashTransactionData;
    /**
     * @notice Get current robustness metrics
     */
    getRobustnessMetrics(): ModelRobustnessMetrics;
    /**
     * @notice Adjust detection threshold dynamically
     */
    setDetectionThreshold(threshold: number): void;
    /**
     * @notice Clean up resources
     */
    shutdown(): Promise<void>;
}
//# sourceMappingURL=adversarial-detector.d.ts.map