/**
 * Friendly aliases over the generated Supabase types.
 *
 * `database.generated.ts` is produced by `npm run db:types` (do not edit by hand).
 * This file re-exports `Database` and exposes the `*Row` / enum aliases the app
 * imports, so application code stays readable.
 */
export type { Json } from './database.generated';
import type { Database as Generated } from './database.generated';

/**
 * TEMPORARY type bridge for `staff_google_credentials` (migration
 * 20260601090000). The table isn't in database.generated.ts yet because that
 * file is regenerated from a linked Supabase project. Once you run
 * `npm run db:types`, delete this augmentation and restore the simple
 * `export type { Database } from './database.generated'` re-export.
 */
export type Database = Generated & {
  public: Generated['public'] & {
    Tables: Generated['public']['Tables'] & {
      // Archive columns added in 20260609120000_client_archive.sql, not yet in
      // database.generated.ts. Merge them in until `npm run db:types` is re-run.
      clients: {
        Row: Generated['public']['Tables']['clients']['Row'] & {
          archived_at: string | null;
          archived_by: string | null;
        };
        Insert: Generated['public']['Tables']['clients']['Insert'] & {
          archived_at?: string | null;
          archived_by?: string | null;
        };
        Update: Generated['public']['Tables']['clients']['Update'] & {
          archived_at?: string | null;
          archived_by?: string | null;
        };
        Relationships: Generated['public']['Tables']['clients']['Relationships'];
      };
      // One-off calendar blocks added in 20260609140000_staff_blocks.sql.
      staff_blocks: {
        Row: {
          id: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          reason: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          starts_at: string;
          ends_at: string;
          reason?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          starts_at?: string;
          ends_at?: string;
          reason?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_blocks_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      // Staff-authored client reports added in 20260615150000_client_reports.sql.
      // `content` holds the structured body (sections/metrics) as jsonb — see
      // ReportContent in lib/reports/queries.ts. Merge into database.generated.ts
      // on the next `npm run db:types`.
      client_reports: {
        Row: {
          id: string;
          client_id: string;
          author_staff_id: string | null;
          type: ('progress' | 'quarterly' | 'results' | 'general');
          title: string;
          period_start: string | null;
          period_end: string | null;
          summary: string | null;
          content: import('./database.generated').Json;
          status: ('draft' | 'published');
          shared_with_client: boolean;
          published_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          author_staff_id?: string | null;
          type?: ('progress' | 'quarterly' | 'results' | 'general');
          title: string;
          period_start?: string | null;
          period_end?: string | null;
          summary?: string | null;
          content?: import('./database.generated').Json;
          status?: ('draft' | 'published');
          shared_with_client?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          author_staff_id?: string | null;
          type?: ('progress' | 'quarterly' | 'results' | 'general');
          title?: string;
          period_start?: string | null;
          period_end?: string | null;
          summary?: string | null;
          content?: import('./database.generated').Json;
          status?: ('draft' | 'published');
          shared_with_client?: boolean;
          published_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'client_reports_client_id_fkey';
            columns: ['client_id'];
            isOneToOne: false;
            referencedRelation: 'clients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'client_reports_author_staff_id_fkey';
            columns: ['author_staff_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      // refresh_token moved into Supabase Vault in 20260615120000; the row now
      // holds only the secret's UUID. App code never reads/writes this column
      // directly — it goes through the get/set RPCs below.
      staff_google_credentials: {
        Row: {
          staff_id: string;
          refresh_token_secret_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          staff_id: string;
          refresh_token_secret_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          staff_id?: string;
          refresh_token_secret_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_google_credentials_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: true;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    // Report enums added in 20260615150000_client_reports.sql. Merge into
    // database.generated.ts on the next `npm run db:types`.
    Enums: Generated['public']['Enums'] & {
      report_type: 'progress' | 'quarterly' | 'results' | 'general';
      report_status: 'draft' | 'published';
    };
    // Vault-backed accessors for the encrypted Google refresh token
    // (20260615120000). Merge into database.generated.ts on the next
    // `npm run db:types`.
    Functions: Generated['public']['Functions'] & {
      get_staff_google_refresh_token: {
        Args: { p_staff_id: string };
        Returns: string | null;
      };
      set_staff_google_refresh_token: {
        Args: { p_staff_id: string; p_token: string };
        Returns: undefined;
      };
    };
  };
};

type Tables = Database['public']['Tables'];
type Enums = Database['public']['Enums'];

export type LocationRow = Tables['locations']['Row'];
export type StaffRow = Tables['staff']['Row'];
export type ServiceRow = Tables['services']['Row'];
export type PackageRow = Tables['packages']['Row'];
export type ClientRow = Tables['clients']['Row'];
export type ClientPackageRow = Tables['client_packages']['Row'];
export type BookingRow = Tables['bookings']['Row'];
export type AssessmentRow = Tables['assessments']['Row'];
export type DocumentRow = Tables['documents']['Row'];
export type ArticleRow = Tables['articles']['Row'];
export type StaffAvailabilityRow = Tables['staff_availability']['Row'];
export type StaffBlockRow = Tables['staff_blocks']['Row'];
export type ClientAssignmentRow = Tables['client_assignments']['Row'];
export type LeadRow = Tables['leads']['Row'];
export type ClientScreeningRow = Tables['client_screenings']['Row'];
export type ClientReportRow = Tables['client_reports']['Row'];

export type LocationStatus = Enums['location_status'];
export type BookingStatus = Enums['booking_status'];
export type PackageStatus = Enums['package_status'];
export type DiscountTier = Enums['discount_tier'];
export type AssessmentType = Enums['assessment_type'];
export type ReportType = Enums['report_type'];
export type ReportStatus = Enums['report_status'];
