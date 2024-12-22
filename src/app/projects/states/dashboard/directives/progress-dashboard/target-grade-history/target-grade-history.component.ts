import { Component, Input, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { GradeService } from 'src/app/common/services/grade.service';
import { DoubtfireConstants } from 'src/app/config/constants/doubtfire-constants';

interface User {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  username: string;
  nickname: string;
}

interface TargetGradeHistory {
  previous_grade: string | number;
  new_grade: string | number;
  changed_at: string;
  changed_by: User;
}

@Component({
  selector: 'f-target-grade-history',
  templateUrl: './target-grade-history.component.html',
  styleUrls: ['./target-grade-history.component.scss'],
})
export class TargetGradeHistoryComponent implements OnInit, OnChanges {
  @Input() projectId!: number;
  @Input() targetGrade!: string; // <-- so we can detect changes in targetGrade

  targetGradeHistory: TargetGradeHistory[] = [];
  paginatedGradeHistory: TargetGradeHistory[] = [];
  loading = false;
  error: string | null = null;

  currentPage = 1;
  itemsPerPage = 10;
  totalPages = 1;

  constructor(
    private http: HttpClient,
    private gradeService: GradeService,
    private constants: DoubtfireConstants
  ) {}

  ngOnInit(): void {
    if (this.projectId) {
      this.loadTargetGradeHistory();
    }
  }

  /**
   * Detect input changes (projectId or targetGrade). 
   * If 'targetGrade' changes, we may re-fetch the data.
   */
  ngOnChanges(changes: SimpleChanges): void {
    // If projectId changes (and not the first time), reload.
    if (changes.projectId && !changes.projectId.firstChange) {
      this.loadTargetGradeHistory();
    }

    // If targetGrade changes (and not the first time), reload TGH
    if (changes.targetGrade && !changes.targetGrade.firstChange) {
      this.loadTargetGradeHistory();
    }
  }

  private loadTargetGradeHistory(): void {
    if (!this.projectId) {
      console.error('No projectId provided');
      this.error = 'Project ID is required';
      return;
    }

    this.loading = true;
    this.error = null;

    const url = `${this.constants.API_URL}/projects/${this.projectId}`;

    this.http
      .get<any>(url)
      .pipe(
        catchError((error) => {
          console.error('Error fetching target grade history:', error);
          this.error = 'Failed to load target grade history';
          return of({ target_grade_histories: [] });
        })
      )
      .subscribe({
        next: (response) => {
          const rawHistories = response.target_grade_histories || [];
          this.targetGradeHistory = rawHistories
            .filter(
              (history: TargetGradeHistory) =>
                history.previous_grade !== undefined && history.new_grade !== undefined
            )
            .map((history: TargetGradeHistory) => ({
              ...history,
              previous_grade: this.gradeService.grades[history.previous_grade] || 'N/A',
              new_grade: this.gradeService.grades[history.new_grade] || 'N/A',
            }))
            .sort((a, b) => new Date(b.changed_at).getTime() - new Date(a.changed_at).getTime()); // newest first

          this.updatePagination();
          this.loading = false;
        },
        error: () => {
          this.error = 'Failed to load target grade history';
          this.loading = false;
        },
      });
  }

  private updatePagination(): void {
    this.totalPages = Math.ceil(this.targetGradeHistory.length / this.itemsPerPage);
    this.updatePaginatedGradeHistory();
  }

  private updatePaginatedGradeHistory(): void {
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    this.paginatedGradeHistory = this.targetGradeHistory.slice(startIndex, endIndex);
  }

  public goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedGradeHistory();
    }
  }
}