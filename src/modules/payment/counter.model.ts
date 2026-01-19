import { Schema, model } from "mongoose";

interface ICounter {
  name: string;
  seq: number;
}

const counterSchema = new Schema<ICounter>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    seq: {
      type: Number,
      default: 1000,
    },
  },
  { versionKey: false },
);

const Counter = model<ICounter>("Counter", counterSchema);

export default Counter;
