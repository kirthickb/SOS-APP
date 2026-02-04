/**
 * ============================================================================
 * ISOLATION FOREST ALGORITHM
 * ============================================================================
 *
 * Purpose:
 * Implements the Isolation Forest anomaly detection algorithm in TypeScript.
 * Used for detecting crashes based on GPS speed and accelerometer data.
 *
 * Algorithm Overview:
 * - Builds random binary search trees on feature subsets
 * - Isolates anomalies by measuring path length to isolate points
 * - Anomaly score = 2^(-avg_path_length / c(n)) where c(n) = avg path length for normal data
 * - Score closer to 1.0 indicates anomaly, closer to 0.5 indicates normal
 *
 * Reference: "Isolation Forest" by Fei Tony Liu et al.
 */

import { CrashFeature } from "./anomalyTypes";

interface Node {
  featureIndex?: number; // Which feature was used to split (0=speed, 1=motion, 2=deltaSpeed)
  splitValue?: number; // Value used for split
  left?: Node; // Left subtree (< splitValue)
  right?: Node; // Right subtree (>= splitValue)
  size?: number; // Number of samples at this node (for leaf nodes)
}

interface ITree {
  root: Node;
  height: number;
}

/**
 * Isolation Forest implementation
 */
class IsolationForest {
  private trees: ITree[] = [];
  private numTrees: number = 100;
  private sampleSize: number = 256;
  private featureNames = ["speed", "motion", "deltaSpeed"];
  private avgPathLengthCache: number = 0;

  /**
   * Calculate average path length constant for normalization
   * Based on average unsuccessful search in BST
   */
  private calculateC(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }

  /**
   * Fit isolation forest on normal driving data
   * @param data - Array of normal driving features
   */
  fit(data: CrashFeature[]): void {
    console.log(
      "🌲 [IsolationForest] Fitting model on",
      data.length,
      "samples"
    );

    if (data.length === 0) {
      console.warn(
        "⚠️ [IsolationForest] Empty training data. Model will not be effective."
      );
      return;
    }

    this.trees = [];

    // Build multiple isolation trees
    for (let i = 0; i < this.numTrees; i++) {
      // Random sample (with replacement)
      const sample = this.randomSample(data, this.sampleSize);
      const tree = this.buildTree(sample, 0);
      this.trees.push(tree);

      if ((i + 1) % 10 === 0) {
        console.debug(`   Built tree ${i + 1}/${this.numTrees}`);
      }
    }

    // Cache average path length for scoring
    this.avgPathLengthCache = this.calculateC(this.sampleSize);

    console.log(
      "✅ [IsolationForest] Model fitted with",
      this.numTrees,
      "trees"
    );
  }

  /**
   * Build a single isolation tree recursively
   */
  private buildTree(
    data: CrashFeature[],
    depth: number,
    maxDepth: number = 12
  ): ITree {
    const node: Node = {};

    // Terminal condition: max depth or single sample
    if (depth >= maxDepth || data.length <= 1) {
      node.size = data.length;
      return {
        root: node,
        height: depth,
      };
    }

    // Randomly select feature and split value
    const featureIndex = Math.floor(Math.random() * 3); // 0, 1, or 2
    const feature = this.getFeature(data, featureIndex);

    if (feature.length === 0) {
      node.size = data.length;
      return {
        root: node,
        height: depth,
      };
    }

    const minVal = Math.min(...feature);
    const maxVal = Math.max(...feature);

    // If all values are same, can't split
    if (minVal === maxVal) {
      node.size = data.length;
      return {
        root: node,
        height: depth,
      };
    }

    const splitValue = minVal + Math.random() * (maxVal - minVal);

    // Partition data
    const left = data.filter(
      (sample) => this.getFeatureValue(sample, featureIndex) < splitValue
    );
    const right = data.filter(
      (sample) => this.getFeatureValue(sample, featureIndex) >= splitValue
    );

    node.featureIndex = featureIndex;
    node.splitValue = splitValue;

    if (left.length > 0) {
      const leftTree = this.buildTree(left, depth + 1, maxDepth);
      node.left = leftTree.root;
    }

    if (right.length > 0) {
      const rightTree = this.buildTree(right, depth + 1, maxDepth);
      node.right = rightTree.root;
    }

    return {
      root: node,
      height:
        Math.max(
          node.left ? this.getTreeHeight(node.left) : 0,
          node.right ? this.getTreeHeight(node.right) : 0
        ) + 1,
    };
  }

  /**
   * Calculate path length for a given feature
   * Returns depth in tree needed to isolate the sample
   */
  private getPathLength(
    node: Node | undefined,
    feature: CrashFeature,
    depth: number = 0
  ): number {
    if (!node) {
      return depth;
    }

    // Terminal node
    if (node.size !== undefined) {
      // Adjust for average successful search in BST
      return depth + this.calculateC(node.size);
    }

    const featureIndex = node.featureIndex!;
    const splitValue = node.splitValue!;
    const value = this.getFeatureValue(feature, featureIndex);

    if (value < splitValue) {
      return this.getPathLength(node.left, feature, depth + 1);
    } else {
      return this.getPathLength(node.right, feature, depth + 1);
    }
  }

  /**
   * Get anomaly score for a single feature
   * Score > 0.7 typically indicates anomaly
   * Score ~ 0.5 indicates normal
   * Score < 0.3 indicates very normal
   */
  getAnomalyScore(feature: CrashFeature): number {
    if (this.trees.length === 0) {
      console.warn("⚠️ [IsolationForest] No trees fitted. Call fit() first.");
      return 0.5; // Return neutral score
    }

    // Calculate average path length across all trees
    let totalPathLength = 0;
    for (const tree of this.trees) {
      const pathLength = this.getPathLength(tree.root, feature);
      totalPathLength += pathLength;
    }

    const avgPathLength = totalPathLength / this.trees.length;

    // Calculate anomaly score
    // Formula: 2^(-E[h(x)] / c(n))
    // where E[h(x)] is average path length across ensemble
    const score = Math.pow(2, -avgPathLength / this.avgPathLengthCache);

    return Math.min(1.0, Math.max(0, score)); // Clamp to [0, 1]
  }

  /**
   * Batch anomaly scoring for multiple features
   */
  getAnomalyScores(features: CrashFeature[]): number[] {
    return features.map((f) => this.getAnomalyScore(f));
  }

  /**
   * Get feature value by index
   */
  private getFeatureValue(sample: CrashFeature, index: number): number {
    const values = [sample.speed, sample.motion, sample.deltaSpeed];
    return values[index] || 0;
  }

  /**
   * Extract feature column from data
   */
  private getFeature(data: CrashFeature[], index: number): number[] {
    const values = [
      data.map((s) => s.speed),
      data.map((s) => s.motion),
      data.map((s) => s.deltaSpeed),
    ];
    return values[index] || [];
  }

  /**
   * Random sample with replacement
   */
  private randomSample(data: CrashFeature[], size: number): CrashFeature[] {
    const sample: CrashFeature[] = [];
    for (let i = 0; i < size; i++) {
      const randomIndex = Math.floor(Math.random() * data.length);
      sample.push(data[randomIndex]);
    }
    return sample;
  }

  /**
   * Get tree height
   */
  private getTreeHeight(node: Node | undefined): number {
    if (!node) return 0;
    if (node.size !== undefined) return 0; // Leaf node

    const leftHeight = this.getTreeHeight(node.left);
    const rightHeight = this.getTreeHeight(node.right);

    return Math.max(leftHeight, rightHeight) + 1;
  }

  /**
   * Get number of fitted trees
   */
  getTreeCount(): number {
    return this.trees.length;
  }

  /**
   * Get model info for debugging
   */
  getModelInfo(): {
    numTrees: number;
    sampleSize: number;
    avgPathLengthConstant: number;
  } {
    return {
      numTrees: this.trees.length,
      sampleSize: this.sampleSize,
      avgPathLengthConstant: this.avgPathLengthCache,
    };
  }
}

export default IsolationForest;
