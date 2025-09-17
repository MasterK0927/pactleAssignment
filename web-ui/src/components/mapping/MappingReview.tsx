import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { ChevronDown, ChevronUp, CheckCircle, AlertCircle, XCircle, Info } from 'lucide-react';

interface MappingCandidate {
  sku_code: string;
  score: number;
  reason: string;
}

interface MappingExplanation {
  matched_fields: string[];
  scores: {
    fuzzy_score: number;
    size_score: number;
    material_score: number;
    alias_score: number;
    total_score: number;
  };
  tolerances: {
    size_tolerance_mm?: number;
    material_match?: boolean;
  };
  assumptions: string[];
  confidence: 'high' | 'medium' | 'low';
  needs_review: boolean;
}

interface MappedLineItem {
  input_text: string;
  qty: number;
  uom: string;
  raw_tokens: {
    description?: string;
    size_token?: string;
    material_token?: string;
    color_token?: string;
  };
  mapping_result: {
    status: 'auto_mapped' | 'needs_review' | 'failed';
    selected_sku?: string;
    candidates: MappingCandidate[];
    explanation: MappingExplanation;
  };
}

interface MappingReviewProps {
  mappedLines: MappedLineItem[];
  onLineUpdate: (index: number, selectedSku: string) => void;
  onApprove: () => void;
}

export const MappingReview: React.FC<MappingReviewProps> = ({
  mappedLines,
  onLineUpdate,
  onApprove,
}) => {
  const [expandedLines, setExpandedLines] = useState<Set<number>>(new Set());

  const toggleExpanded = (index: number) => {
    const newExpanded = new Set(expandedLines);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedLines(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'auto_mapped':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'needs_review':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <Info className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
      auto_mapped: 'default',
      needs_review: 'secondary',
      failed: 'destructive',
    };

    const variantType: "default" | "destructive" | "outline" | "secondary" = variants[status] || 'outline';
    return (
      <Badge variant={variantType}>
        {status.replace('_', ' ').toUpperCase()}
      </Badge>
    );
  };

  const getConfidenceBadge = (confidence: string) => {
    const colors = {
      high: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[confidence as keyof typeof colors] || colors.low}`}>
        {confidence.toUpperCase()}
      </span>
    );
  };

  const summary = {
    total: mappedLines.length,
    auto_mapped: mappedLines.filter(l => l.mapping_result.status === 'auto_mapped').length,
    needs_review: mappedLines.filter(l => l.mapping_result.status === 'needs_review').length,
    failed: mappedLines.filter(l => l.mapping_result.status === 'failed').length,
  };

  const allResolved = summary.needs_review === 0 && summary.failed === 0;

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle>Mapping Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold">{summary.total}</div>
              <div className="text-sm text-gray-600">Total Lines</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">{summary.auto_mapped}</div>
              <div className="text-sm text-gray-600">Auto Mapped</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-yellow-600">{summary.needs_review}</div>
              <div className="text-sm text-gray-600">Needs Review</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">{summary.failed}</div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mapping Lines */}
      <div className="space-y-4">
        {mappedLines.map((line, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(line.mapping_result.status)}
                  <div>
                    <div className="font-medium">{line.input_text}</div>
                    <div className="text-sm text-gray-600">
                      Qty: {line.qty} {line.uom}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {getStatusBadge(line.mapping_result.status)}
                  {getConfidenceBadge(line.mapping_result.explanation.confidence)}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExpanded(index)}
                  >
                    {expandedLines.has(index) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardHeader>

            {expandedLines.has(index) && (
              <CardContent>
                <div className="space-y-4">
                  {/* Selected SKU or Selection */}
                  <div>
                    <h4 className="font-medium mb-2">SKU Selection</h4>
                    {line.mapping_result.status === 'auto_mapped' && line.mapping_result.selected_sku ? (
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span className="font-medium">{line.mapping_result.selected_sku}</span>
                        <span className="text-sm text-gray-600">
                          (Score: {(line.mapping_result.explanation.scores.total_score * 100).toFixed(1)}%)
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <select
                          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          onChange={(e) => onLineUpdate(index, e.target.value)}
                          defaultValue=""
                        >
                          <option value="" disabled>
                            Select a SKU candidate
                          </option>
                          {line.mapping_result.candidates.map((candidate, idx) => (
                            <option key={idx} value={candidate.sku_code}>
                              {candidate.sku_code} - {(candidate.score * 100).toFixed(1)}% match
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Candidates */}
                  <div>
                    <h4 className="font-medium mb-2">Candidates</h4>
                    <div className="space-y-2">
                      {line.mapping_result.candidates.slice(0, 3).map((candidate, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                          <div>
                            <div className="font-medium">{candidate.sku_code}</div>
                            <div className="text-sm text-gray-600">{candidate.reason}</div>
                          </div>
                          <div className="text-sm font-medium">
                            {(candidate.score * 100).toFixed(1)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <Separator />

                  {/* Explanation */}
                  <div>
                    <h4 className="font-medium mb-2">Explanation</h4>
                    <div className="space-y-3">
                      <div>
                        <div className="text-sm font-medium mb-1">Matched Fields:</div>
                        <div className="flex flex-wrap gap-1">
                          {line.mapping_result.explanation.matched_fields.map((field, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {field}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Score Breakdown:</div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div>Fuzzy: {(line.mapping_result.explanation.scores.fuzzy_score * 100).toFixed(1)}%</div>
                          <div>Size: {(line.mapping_result.explanation.scores.size_score * 100).toFixed(1)}%</div>
                          <div>Material: {(line.mapping_result.explanation.scores.material_score * 100).toFixed(1)}%</div>
                          <div>Alias: {(line.mapping_result.explanation.scores.alias_score * 100).toFixed(1)}%</div>
                        </div>
                      </div>

                      <div>
                        <div className="text-sm font-medium mb-1">Assumptions:</div>
                        <ul className="text-sm text-gray-600 list-disc list-inside">
                          {line.mapping_result.explanation.assumptions.map((assumption, idx) => (
                            <li key={idx}>{assumption}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-2">
        <Button
          onClick={onApprove}
          disabled={!allResolved}
          className="px-6"
        >
          {allResolved ? 'Approve & Continue' : 'Resolve Issues First'}
        </Button>
      </div>
    </div>
  );
};