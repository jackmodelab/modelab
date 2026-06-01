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
      staff_google_credentials: {
        Row: {
          staff_id: string;
          refresh_token: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          staff_id: string;
          refresh_token: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          staff_id?: string;
          refresh_token?: string;
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
export type ClientAssignmentRow = Tables['client_assignments']['Row'];
export type LeadRow = Tables['leads']['Row'];
export type ClientScreeningRow = Tables['client_screenings']['Row'];

export type LocationStatus = Enums['location_status'];
export type BookingStatus = Enums['booking_status'];
export type PackageStatus = Enums['package_status'];
export type DiscountTier = Enums['discount_tier'];
export type AssessmentType = Enums['assessment_type'];
