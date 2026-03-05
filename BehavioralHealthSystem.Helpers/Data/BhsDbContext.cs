using BehavioralHealthSystem.Helpers.Models;
using BehavioralHealthSystem.Models;
using Microsoft.EntityFrameworkCore;

namespace BehavioralHealthSystem.Helpers.Data;

/// <summary>
/// Entity Framework Core DbContext for the Behavioral Health System.
/// Used when STORAGE_BACKEND is set to "PostgreSQL".
/// </summary>
public class BhsDbContext : DbContext
{
    public BhsDbContext(DbContextOptions<BhsDbContext> options) : base(options) { }

    // ==================== Chat Transcripts ====================
    public DbSet<ChatTranscriptData> ChatTranscripts { get; set; } = null!;
    public DbSet<ChatMessageData> ChatMessages { get; set; } = null!;
    public DbSet<ChatSessionMetadata> ChatSessionMetadata { get; set; } = null!;

    // ==================== PHQ Assessments ====================
    public DbSet<PhqAssessmentData> PhqAssessments { get; set; } = null!;
    public DbSet<PhqQuestionData> PhqQuestions { get; set; } = null!;
    public DbSet<PhqMetadata> PhqMetadata { get; set; } = null!;

    // ==================== PHQ Progress ====================
    public DbSet<PhqProgressData> PhqProgress { get; set; } = null!;
    public DbSet<PhqAnsweredQuestion> PhqAnsweredQuestions { get; set; } = null!;
    public DbSet<PhqProgressMetadata> PhqProgressMetadata { get; set; } = null!;

    // ==================== PHQ Sessions ====================
    public DbSet<PhqSessionData> PhqSessions { get; set; } = null!;
    public DbSet<PhqQuestionResponse> PhqQuestionResponses { get; set; } = null!;
    public DbSet<PhqSessionMetadata> PhqSessionMetadata { get; set; } = null!;

    // ==================== Smart Band / Biometric ====================
    public DbSet<SmartBandDataSnapshot> SmartBandSnapshots { get; set; } = null!;

    // ==================== Audio ====================
    public DbSet<AudioMetadata> AudioMetadata { get; set; } = null!;

    // ==================== DSM-5 ====================
    public DbSet<DSM5ConditionData> Dsm5Conditions { get; set; } = null!;

    // ==================== Session / FileGroup / Biometric (existing models) ====================
    public DbSet<SessionData> Sessions { get; set; } = null!;
    public DbSet<FileGroup> FileGroups { get; set; } = null!;
    public DbSet<UserBiometricData> UserBiometricData { get; set; } = null!;
    public DbSet<ExtendedAssessmentJob> ExtendedAssessmentJobs { get; set; } = null!;

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ==================== Chat Transcript Configuration ====================
        modelBuilder.Entity<ChatTranscriptData>(entity =>
        {
            entity.ToTable("chat_transcripts");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SessionId).IsUnique();
            entity.HasMany(e => e.Messages)
                  .WithOne(m => m.ChatTranscript)
                  .HasForeignKey(m => m.ChatTranscriptDataId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Metadata)
                  .WithOne(m => m.ChatTranscript)
                  .HasForeignKey<ChatSessionMetadata>(m => m.ChatTranscriptDataId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ChatMessageData>(entity =>
        {
            entity.ToTable("chat_messages");
            entity.HasIndex(e => e.Id);
        });

        modelBuilder.Entity<ChatSessionMetadata>(entity =>
        {
            entity.ToTable("chat_session_metadata");
        });

        // ==================== PHQ Assessment Configuration ====================
        modelBuilder.Entity<PhqAssessmentData>(entity =>
        {
            entity.ToTable("phq_assessments");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.AssessmentId).IsUnique();
            entity.HasMany(e => e.Questions)
                  .WithOne(q => q.Assessment)
                  .HasForeignKey(q => q.PhqAssessmentDataId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Metadata)
                  .WithOne(m => m.Assessment)
                  .HasForeignKey<PhqMetadata>(m => m.PhqAssessmentDataId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PhqQuestionData>(entity =>
        {
            entity.ToTable("phq_assessment_questions");
        });

        modelBuilder.Entity<PhqMetadata>(entity =>
        {
            entity.ToTable("phq_assessment_metadata");
        });

        // ==================== PHQ Progress Configuration ====================
        modelBuilder.Entity<PhqProgressData>(entity =>
        {
            entity.ToTable("phq_progress");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.AssessmentId);
            entity.HasMany(e => e.AnsweredQuestions)
                  .WithOne(q => q.Progress)
                  .HasForeignKey(q => q.PhqProgressDataId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Metadata)
                  .WithOne(m => m.Progress)
                  .HasForeignKey<PhqProgressMetadata>(m => m.PhqProgressDataId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PhqAnsweredQuestion>(entity =>
        {
            entity.ToTable("phq_answered_questions");
        });

        modelBuilder.Entity<PhqProgressMetadata>(entity =>
        {
            entity.ToTable("phq_progress_metadata");
        });

        // ==================== PHQ Session Configuration ====================
        modelBuilder.Entity<PhqSessionData>(entity =>
        {
            entity.ToTable("phq_sessions");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.AssessmentId);
            entity.HasMany(e => e.Questions)
                  .WithOne(q => q.Session)
                  .HasForeignKey(q => q.PhqSessionDataId)
                  .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Metadata)
                  .WithOne(m => m.Session)
                  .HasForeignKey<PhqSessionMetadata>(m => m.PhqSessionDataId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<PhqQuestionResponse>(entity =>
        {
            entity.ToTable("phq_session_questions");
        });

        modelBuilder.Entity<PhqSessionMetadata>(entity =>
        {
            entity.ToTable("phq_session_metadata");
        });

        // ==================== Smart Band Configuration ====================
        modelBuilder.Entity<SmartBandDataSnapshot>(entity =>
        {
            entity.ToTable("smart_band_snapshots");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SavedAt);
        });

        // ==================== Audio Metadata Configuration ====================
        modelBuilder.Entity<AudioMetadata>(entity =>
        {
            entity.ToTable("audio_metadata");
            entity.HasIndex(e => e.UserId);
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.UploadedAt);
        });

        // ==================== DSM-5 Configuration ====================
        modelBuilder.Entity<DSM5ConditionData>(entity =>
        {
            entity.ToTable("dsm5_conditions");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.HasIndex(e => e.Category);
            entity.HasIndex(e => e.Code);

            // Store complex collections as JSON columns
            entity.Property(e => e.DiagnosticCriteria)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<DSM5DiagnosticCriterion>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.DifferentialDiagnosis)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.Specifiers)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<DSM5Specifier>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.RiskAndPrognosticFactors)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<DSM5RiskFactors>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.ExtractionMetadata)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<DSM5ExtractionMetadata>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.PageNumbers)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<int>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.PresentSections)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.MissingSections)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);
        });

        // ==================== Session Data Configuration ====================
        modelBuilder.Entity<SessionData>(entity =>
        {
            entity.ToTable("sessions");
            entity.HasKey(e => e.SessionId);
            entity.Property(e => e.SessionId).ValueGeneratedNever();
            entity.HasIndex(e => e.UserId);

            // Store complex objects as JSON columns
            entity.Property(e => e.Prediction)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<PredictionResult>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.UserMetadata)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<UserMetadata>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.AnalysisResults)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<AnalysisResults>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.RiskAssessment)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<RiskAssessment>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.ExtendedRiskAssessment)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<ExtendedRiskAssessment>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.MultiConditionAssessment)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<MultiConditionExtendedRiskAssessment>(v, (JsonSerializerOptions?)null));

            entity.Property(e => e.DSM5Conditions)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);
        });

        // ==================== File Group Configuration ====================
        modelBuilder.Entity<FileGroup>(entity =>
        {
            entity.ToTable("file_groups");
            entity.HasKey(e => e.GroupId);
            entity.Property(e => e.GroupId).ValueGeneratedNever();
        });

        // ==================== User Biometric Data Configuration ====================
        modelBuilder.Entity<UserBiometricData>(entity =>
        {
            entity.ToTable("user_biometric_data");
            entity.HasKey(e => e.UserId);
            entity.Property(e => e.UserId).ValueGeneratedNever();

            // Store list properties as JSON
            entity.Property(e => e.Hobbies)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.Likes)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);

            entity.Property(e => e.Dislikes)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => JsonSerializer.Deserialize<List<string>>(v, (JsonSerializerOptions?)null)!);
        });

        // ==================== Extended Assessment Job Configuration ====================
        modelBuilder.Entity<ExtendedAssessmentJob>(entity =>
        {
            entity.ToTable("extended_assessment_jobs");
            entity.HasKey(e => e.JobId);
            entity.Property(e => e.JobId).ValueGeneratedNever();
            entity.HasIndex(e => e.SessionId);
            entity.HasIndex(e => e.Status);

            // Ignore computed properties
            entity.Ignore(e => e.ElapsedTime);
            entity.Ignore(e => e.ProcessingTime);
            entity.Ignore(e => e.IsCompleted);
            entity.Ignore(e => e.IsProcessing);
            entity.Ignore(e => e.CanRetry);

            // Store complex objects as JSON
            entity.Property(e => e.Result)
                  .HasColumnType("jsonb")
                  .HasConversion(
                      v => v == null ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                      v => v == null ? null : JsonSerializer.Deserialize<ExtendedRiskAssessment>(v, (JsonSerializerOptions?)null));
        });
    }
}
