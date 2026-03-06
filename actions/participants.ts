'use server';

import clientPromise from '@/lib/mongodb';
import { DBParticipant } from '@/types';
import { ObjectId, WithId, Document } from 'mongodb';

const DB_NAME = 'hackoverflow';
const COLLECTION_NAME = 'participants';

/**
 * MongoDB document type for participants
 */
type ParticipantDocument = Omit<DBParticipant, '_id'> & {
  _id?: ObjectId;
};

/**
 * Get database collection
 */
async function getCollection() {
  const client = await clientPromise;
  const db = client.db(DB_NAME);
  return db.collection<ParticipantDocument>(COLLECTION_NAME);
}

/**
 * Get all participants from database
 */
export async function getParticipants(): Promise<DBParticipant[]> {
  try {
    const collection = await getCollection();
    const participants = await collection
      .find({})
      .sort({ createdAt: -1 })
      .toArray();

    return participants.map(p => ({
      ...p,
      _id: p._id?.toString(),
    } as DBParticipant));
  } catch (error) {
    console.error('Error fetching participants:', error);
    throw new Error('Failed to fetch participants');
  }
}

/**
 * Get a single participant by ID
 */
export async function getParticipantById(id: string): Promise<DBParticipant | null> {
  try {
    const collection = await getCollection();
    const participant = await collection.findOne({ _id: new ObjectId(id) });

    if (!participant) return null;

    return {
      ...participant,
      _id: participant._id?.toString(),
    } as DBParticipant;
  } catch (error) {
    console.error('Error fetching participant:', error);
    return null;
  }
}

/**
 * Create multiple participants from CSV upload
 */
export async function createParticipants(
  participants: Omit<DBParticipant, '_id' | 'createdAt' | 'updatedAt'>[]
): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const collection = await getCollection();

    const participantsWithTimestamps = participants.map(p => ({
      ...p,
      collegeCheckIn: p.collegeCheckIn || { status: false },
      labCheckIn: p.labCheckIn || { status: false },
      collegeCheckOut: p.collegeCheckOut || { status: false },
      labCheckOut: p.labCheckOut || { status: false },
      tempLabCheckOut: p.tempLabCheckOut || { status: false },
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    const result = await collection.insertMany(participantsWithTimestamps);

    return {
      success: true,
      count: result.insertedCount,
    };
  } catch (error) {
    console.error('Error creating participants:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Failed to create participants',
    };
  }
}

/**
 * Update a participant
 */
export async function updateParticipant(
  id: string,
  updates: Partial<Omit<DBParticipant, '_id' | 'createdAt'>>
): Promise<{ success: boolean; error?: string }> {
  try {
    const collection = await getCollection();

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Participant not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating participant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update participant',
    };
  }
}

/**
 * Delete a participant
 */
export async function deleteParticipant(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const collection = await getCollection();

    const result = await collection.deleteOne({ _id: new ObjectId(id) });

    if (result.deletedCount === 0) {
      return { success: false, error: 'Participant not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error deleting participant:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to delete participant',
    };
  }
}

/**
 * Update check-in status
 */
export async function updateCheckInStatus(
  id: string,
  type: 'college' | 'lab' | 'collegeOut' | 'labOut' | 'tempLabOut',
  status: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const collection = await getCollection();

    const updateField =
      type === 'college' ? 'collegeCheckIn' :
        type === 'lab' ? 'labCheckIn' :
          type === 'collegeOut' ? 'collegeCheckOut' :
            type === 'labOut' ? 'labCheckOut' :
              'tempLabCheckOut';

    const result = await collection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          [updateField]: {
            status,
            time: status ? new Date() : undefined,
          },
          updatedAt: new Date(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return { success: false, error: 'Participant not found' };
    }

    return { success: true };
  } catch (error) {
    console.error('Error updating check-in status:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update check-in status',
    };
  }
}

/**
 * Delete all participants (use with caution)
 */
export async function deleteAllParticipants(): Promise<{ success: boolean; count: number; error?: string }> {
  try {
    const collection = await getCollection();
    const result = await collection.deleteMany({});

    return {
      success: true,
      count: result.deletedCount,
    };
  } catch (error) {
    console.error('Error deleting all participants:', error);
    return {
      success: false,
      count: 0,
      error: error instanceof Error ? error.message : 'Failed to delete participants',
    };
  }
} 