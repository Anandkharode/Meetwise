import mongoose from 'mongoose';

const deadlineSchema = new mongoose.Schema(
  {
    originalText: { type: String, trim: true, default: null },
    normalizedDate: { type: Date, default: null },
  },
  { _id: false },
);

const taskSchema = new mongoose.Schema(
  {
    meetingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Meeting', required: true },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    action: { type: String, trim: true, default: null },
    responsiblePerson: { type: String, trim: true, default: null },
    deadline: { type: deadlineSchema, default: null },
    priority: { type: String, enum: ['low', 'medium', 'high'], default: null },
    status: {
      type: String,
      enum: ['pending', 'in_progress', 'completed'],
      default: 'pending',
    },
    sourceSentence: { type: String, required: true, trim: true },
    confidence: { type: Number, min: 0, max: 1 },
    warnings: { type: [String], default: [] },
    origin: { type: String, enum: ['manual', 'ai'], default: 'manual' },
    analysisRunId: { type: String, default: null },
    isManuallyEdited: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

taskSchema.index({ meetingId: 1 });
taskSchema.index({ createdBy: 1, status: 1 });
taskSchema.index({ responsiblePerson: 1 });
taskSchema.index({ 'deadline.normalizedDate': 1 });

const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export default Task;
