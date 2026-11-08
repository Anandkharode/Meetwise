import mongoose from 'mongoose';

const decisionSchema = new mongoose.Schema(
  {
    description: { type: String, required: true, trim: true },
    sourceSentence: { type: String, trim: true, default: null },
    confidence: { type: Number, min: 0, max: 1 },
  },
  { _id: false },
);

const audioSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true, default: null },
    filename: { type: String, trim: true, default: null },
    filePath: { type: String, trim: true, default: null },
    mimeType: { type: String, trim: true, default: null },
    fileSize: { type: Number, min: 0, default: null },
    duration: { type: Number, min: 0, default: null },
  },
  { _id: false },
);

const entitiesSchema = new mongoose.Schema(
  {
    people: { type: [String], default: [] },
    organizations: { type: [String], default: [] },
    dates: { type: [String], default: [] },
  },
  { _id: false },
);

const analysisMetadataSchema = new mongoose.Schema(
  {
    totalSentences: { type: Number, min: 0, default: 0 },
    tasksFound: { type: Number, min: 0, default: 0 },
    decisionsFound: { type: Number, min: 0, default: 0 },
    processingTimeMs: { type: Number, min: 0, default: 0 },
    warnings: { type: [String], default: [] },
  },
  { _id: false },
);

const meetingSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 300 },
    meetingDate: { type: Date, required: true },
    transcript: {
      type: String,
      trim: true,
      default: '',
      required() {
        return this.sourceType === 'text' || this.analysisStatus === 'completed';
      },
    },
    sourceType: { type: String, enum: ['text', 'audio'], default: 'text' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Audio bytes are stored on local disk; this document stores metadata only.
    audio: { type: audioSchema, default: undefined },
    summary: { type: String, trim: true, default: '' },
    keyPoints: { type: [String], default: [] },
    entities: { type: entitiesSchema, default: () => ({}) },
    decisions: { type: [decisionSchema], default: [] },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisError: { type: String, trim: true, default: null },
    analysisStartedAt: { type: Date, default: null },
    analysisRunId: { type: String, default: null },
    analysisMetadata: { type: analysisMetadataSchema, default: () => ({}) },
  },
  { timestamps: true },
);

meetingSchema.index({ createdBy: 1, createdAt: -1 });
meetingSchema.index({ analysisStatus: 1 });

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);
export default Meeting;
