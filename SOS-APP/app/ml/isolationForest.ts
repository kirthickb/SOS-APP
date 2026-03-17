import { CrashFeature } from './anomalyTypes';

type FeatureKey = keyof CrashFeature;

interface IsolationNode {
    feature?: FeatureKey;
    splitValue?: number;
    left?: IsolationNode;
    right?: IsolationNode;
    size: number;
}

type IsolationTree = {
    root: IsolationNode;
};

type IsolationForestOptions = {
    numTrees?: number;
    sampleSize?: number;
    maxDepth?: number;
};

const EULER_GAMMA = 0.5772156649;

class IsolationForest {
    private trees: IsolationTree[] = [];
    private readonly numTrees: number;
    private readonly sampleSize: number;
    private readonly maxDepth: number;
    private readonly features: FeatureKey[] = ["speed", "motion", "deltaSpeed"];

    constructor(options: IsolationForestOptions = {}) {
        this.numTrees = Math.max(1, options.numTrees ?? 100);
        this.sampleSize = Math.max(2, options.sampleSize ?? 256);
        this.maxDepth = options.maxDepth ?? Math.ceil(Math.log2(this.sampleSize));
    }

    /**
     * Train the isolation forest on a dataset
     */
    fit(data: CrashFeature[]): void {
        this.trees = [];
        
        if (data.length < 2) {
            console.warn("⚠️ [IsolationForest] Not enough data to train (min 2 samples required)");
            return;
        }
        
        const effectiveSampleSize = Math.min(data.length, this.sampleSize);
        
        for (let i = 0; i < this.numTrees; i += 1) {
            const sample = this.randomSampleWithReplacement(data, effectiveSampleSize);
            const root = this.buildTree(sample, 0);
            this.trees.push({ root });
        }
    }

    /**
     * Calculate anomaly score (0 to 1)
     * Higher score = more anomalous
     */
    getAnomalyScore(feature: CrashFeature): number {
        if (this.trees.length === 0) {
            return 0.5;
        }

        let totalPathLength = 0;
        for (const tree of this.trees) {
            totalPathLength += this.getPathLength(tree.root, feature, 0);
        }
        
        const avgPathLength = totalPathLength / this.trees.length;
        const normalization = this.c(this.sampleSize);
        
        if (normalization <= 0) {
            return 0.5;
        }

        const score = Math.pow(2, -avgPathLength / normalization);
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Export the model for persistence
     */
    exportModel(): string {
        return JSON.stringify({
            trees: this.trees,
            numTrees: this.numTrees,
            sampleSize: this.sampleSize,
            maxDepth: this.maxDepth
        });
    }

    /**
     * Import a previously exported model
     */
    importModel(json: string): void {
        try {
            const data = JSON.parse(json);
            this.trees = data.trees || [];
        } catch (e) {
            console.error("❌ [IsolationForest] Failed to import model", e);
        }
    }

    private buildTree(data: CrashFeature[], depth: number): IsolationNode {
        const node: IsolationNode = { size: data.length };

        if (depth >= this.maxDepth || data.length <= 1) {
            return node;
        }

        // Select a random feature
        const feature = this.features[Math.floor(Math.random() * this.features.length)];
        
        // Find min and max for the selected feature
        let min = Infinity;
        let max = -Infinity;
        for (const row of data) {
            const val = row[feature];
            if (val < min) min = val;
            if (val > max) max = val;
        }

        if (min === max) {
            return node;
        }

        const splitValue = min + Math.random() * (max - min);
        const left: CrashFeature[] = [];
        const right: CrashFeature[] = [];
        
        for (const row of data) {
            if (row[feature] < splitValue) {
                left.push(row);
            } else {
                right.push(row);
            }
        }
        
        if (left.length === 0 || right.length === 0) {
            return node;
        }

        node.feature = feature;
        node.splitValue = splitValue;
        node.left = this.buildTree(left, depth + 1);
        node.right = this.buildTree(right, depth + 1);

        return node;
    }
    
    private getPathLength(node: IsolationNode, feature: CrashFeature, depth: number): number {
        if (!node.feature || node.splitValue === undefined || !node.left || !node.right) {
            return depth + this.c(node.size);
        }

        const value = feature[node.feature];
        if (value < node.splitValue) {
            return this.getPathLength(node.left, feature, depth + 1);
        }

        return this.getPathLength(node.right, feature, depth + 1);
    }
    
    private randomSampleWithReplacement(data: CrashFeature[], size: number): CrashFeature[] {
        const sample: CrashFeature[] = [];

        for (let i = 0; i < size; i += 1) {
            const index = Math.floor(Math.random() * data.length);
            sample.push(data[index]);
        }

        return sample;
    }

    private c(n: number): number {
        if (n <= 1) {
            return 0;
        }

        if (n === 2) {
            return 1;
        }

        return 2 * (Math.log(n - 1) + EULER_GAMMA) - (2 * (n - 1)) / n;
    }
}

export default IsolationForest;
