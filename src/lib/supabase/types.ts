/**
 * Database types for the yourATS schema.
 *
 * Hand-written to mirror supabase/schema.sql. Once the Supabase CLI is wired up
 * you can replace this file with generated output:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/supabase/types.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type OrgRole = "owner" | "admin" | "recruiter" | "viewer"
export type JobStatus = "draft" | "open" | "closed" | "archived"
export type ApplicationStatus = "active" | "hired" | "rejected" | "withdrawn"

type Timestamps = { created_at: string; updated_at: string }

export interface Database {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          created_by: string | null
        } & Timestamps
        Insert: {
          id?: string
          name: string
          slug: string
          logo_url?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["organizations"]["Insert"]>
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
        } & Timestamps
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
        Relationships: []
      }
      org_members: {
        Row: {
          id: string
          org_id: string
          user_id: string
          role: OrgRole
          created_at: string
        }
        Insert: {
          id?: string
          org_id: string
          user_id: string
          role?: OrgRole
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["org_members"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          id: string
          org_id: string
          title: string
          description: string | null
          location: string | null
          department: string | null
          employment_type: string | null
          status: JobStatus
          created_by: string | null
        } & Timestamps
        Insert: {
          id?: string
          org_id: string
          title: string
          description?: string | null
          location?: string | null
          department?: string | null
          employment_type?: string | null
          status?: JobStatus
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["jobs"]["Insert"]>
        Relationships: []
      }
      job_stages: {
        Row: {
          id: string
          job_id: string
          org_id: string
          name: string
          position: number
          created_at: string
        }
        Insert: {
          id?: string
          job_id: string
          org_id: string
          name: string
          position?: number
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["job_stages"]["Insert"]>
        Relationships: []
      }
      candidates: {
        Row: {
          id: string
          org_id: string
          full_name: string
          email: string | null
          phone: string | null
          resume_url: string | null
          parsed_resume: Json | null
          skills: string[]
          source: string | null
        } & Timestamps
        Insert: {
          id?: string
          org_id: string
          full_name: string
          email?: string | null
          phone?: string | null
          resume_url?: string | null
          parsed_resume?: Json | null
          skills?: string[]
          source?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["candidates"]["Insert"]>
        Relationships: []
      }
      applications: {
        Row: {
          id: string
          org_id: string
          job_id: string
          candidate_id: string
          stage_id: string | null
          status: ApplicationStatus
          match_score: number | null
          position: number
          applied_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          org_id: string
          job_id: string
          candidate_id: string
          stage_id?: string | null
          status?: ApplicationStatus
          match_score?: number | null
          position?: number
          applied_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["applications"]["Insert"]>
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "job_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      application_notes: {
        Row: {
          id: string
          application_id: string
          org_id: string
          author_id: string | null
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          application_id: string
          org_id: string
          author_id?: string | null
          body: string
          created_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["application_notes"]["Insert"]>
        Relationships: []
      }
      scorecards: {
        Row: {
          id: string
          application_id: string
          org_id: string
          author_id: string | null
          rating: number | null
          feedback: string | null
          criteria: Json | null
        } & Timestamps
        Insert: {
          id?: string
          application_id: string
          org_id: string
          author_id?: string | null
          rating?: number | null
          feedback?: string | null
          criteria?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["scorecards"]["Insert"]>
        Relationships: []
      }
      org_invitations: {
        Row: {
          id: string
          org_id: string
          email: string
          role: OrgRole
          invited_by: string | null
          accepted_at: string | null
          created_at: string
          expires_at: string
        }
        Insert: {
          id?: string
          org_id: string
          email: string
          role?: OrgRole
          invited_by?: string | null
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
        }
        Update: Partial<Database["public"]["Tables"]["org_invitations"]["Insert"]>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_org_member: {
        Args: { p_org_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: { p_org_id: string; p_roles: OrgRole[] }
        Returns: boolean
      }
    }
    Enums: {
      org_role: OrgRole
      job_status: JobStatus
      application_status: ApplicationStatus
    }
    CompositeTypes: Record<string, never>
  }
}
