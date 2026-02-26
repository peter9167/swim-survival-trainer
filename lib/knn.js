/**
 * K-Nearest Neighbors 분류기
 * Teachable Machine과 동일한 원리: 샘플 저장 → 거리 기반 투표
 */
export class KNNClassifier {
  constructor(k = 5) {
    this.k = k;
    this.samples = {}; // label → [featureArrays]
  }

  addSample(label, features) {
    if (!this.samples[label]) this.samples[label] = [];
    this.samples[label].push([...features]);
  }

  getSampleCounts() {
    const counts = {};
    for (const [label, arr] of Object.entries(this.samples)) {
      counts[label] = arr.length;
    }
    return counts;
  }

  get totalSamples() {
    return Object.values(this.samples).reduce((s, a) => s + a.length, 0);
  }

  get numClasses() {
    return Object.keys(this.samples).filter(
      (k) => this.samples[k].length > 0
    ).length;
  }

  predict(features) {
    if (this.totalSamples === 0 || this.numClasses < 2) {
      return { label: null, confidence: 0 };
    }

    const distances = [];
    for (const [label, samples] of Object.entries(this.samples)) {
      for (const sample of samples) {
        let dist = 0;
        for (let i = 0; i < features.length; i++) {
          dist += (features[i] - sample[i]) ** 2;
        }
        distances.push({ label, dist: Math.sqrt(dist) });
      }
    }

    distances.sort((a, b) => a.dist - b.dist);
    const topK = distances.slice(0, this.k);

    // 가중 투표 (거리 역수)
    const votes = {};
    for (const { label, dist } of topK) {
      const weight = 1 / (dist + 0.0001);
      votes[label] = (votes[label] || 0) + weight;
    }

    let bestLabel = null,
      bestScore = 0,
      totalScore = 0;
    for (const [label, score] of Object.entries(votes)) {
      totalScore += score;
      if (score > bestScore) {
        bestScore = score;
        bestLabel = label;
      }
    }

    return { label: bestLabel, confidence: bestScore / totalScore };
  }

  clear() {
    this.samples = {};
  }

  export() {
    return JSON.stringify(this.samples);
  }

  import(json) {
    try {
      this.samples = JSON.parse(json);
    } catch (e) {
      console.error("KNN import failed", e);
    }
  }
}
